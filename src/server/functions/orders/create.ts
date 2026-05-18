import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { db } from "#/db/index";
import { customers, orderItems, orders } from "#/db/schema";
import { writeAudit } from "#/server/audit";
import { requireSession } from "#/server/middleware";
import { createOrderSchema } from "#/shared/schemas/order";

export const createOrder = createServerFn({ method: "POST" })
	.inputValidator(createOrderSchema)
	.handler(async ({ data }) => {
		const session = await requireSession();

		const subtotal = data.items.reduce(
			(sum, item) => sum + item.unitPriceThb * item.quantity,
			0,
		);
		const total = subtotal + data.shippingFeeThb;

		const [order] = await db
			.insert(orders)
			.values({
				roundId: data.roundId,
				customerId: data.customerId,
				addressId: data.addressId ?? null,
				subtotalThb: subtotal.toFixed(2),
				shippingFeeThb: data.shippingFeeThb.toFixed(2),
				totalThb: total.toFixed(2),
				notes: data.notes ?? null,
			})
			.returning();

		await db.insert(orderItems).values(
			data.items.map((item) => ({
				orderId: order.id,
				roundProductId: item.roundProductId,
				quantity: item.quantity,
				unitPriceThb: item.unitPriceThb.toFixed(2),
				lineTotalThb: (item.unitPriceThb * item.quantity).toFixed(2),
			})),
		);

		// Update customer's last_ordered_at
		await db
			.update(customers)
			.set({ lastOrderedAt: new Date() })
			.where(eq(customers.id, data.customerId));

		await writeAudit({
			userId: session.user.id,
			entity: "order",
			entityId: order.id,
			action: "create",
			diff: { items: data.items.length, total },
		});

		return order;
	});
