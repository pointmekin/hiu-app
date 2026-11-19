import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { db } from "#/db/index";
import { customers, orderItems, orders } from "#/db/schema";
import { writeAudit } from "#/server/audit";
import { requireSession } from "#/server/middleware";
import { createOrderSchema } from "#/shared/schemas/order";
import { lockRound, priceOrderItems } from "./pricing";

export const createOrder = createServerFn({ method: "POST" })
	.validator(createOrderSchema)
	.handler(async ({ data }) => {
		const session = await requireSession();

		const order = await db.transaction(async (tx) => {
			await lockRound(tx, data.roundId);
			const items = await priceOrderItems(tx, data.roundId, data.items);
			const subtotal = items.reduce(
				(sum, item) => sum + Number(item.lineTotalThb),
				0,
			);
			const total = subtotal + data.shippingFeeThb;

			const [order] = await tx
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

			await tx
				.insert(orderItems)
				.values(items.map((item) => ({ ...item, orderId: order.id })));

			return order;
		});

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
			diff: { items: data.items.length, total: Number(order.totalThb) },
		});

		return order;
	});
