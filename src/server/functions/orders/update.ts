import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { db } from "#/db/index";
import { customers, orderItems, orders } from "#/db/schema";
import { writeAudit } from "#/server/audit";
import { requireSession } from "#/server/middleware";
import { updateOrderSchema } from "#/shared/schemas/order";

export const updateOrder = createServerFn({ method: "POST" })
	.inputValidator(updateOrderSchema)
	.handler(async ({ data }) => {
		const session = await requireSession();
		const { id, ...fields } = data;

		const [current] = await db
			.select({ subtotalThb: orders.subtotalThb, shippingFeeThb: orders.shippingFeeThb })
			.from(orders)
			.where(eq(orders.id, id))
			.limit(1);

		if (!current) throw new Error("Order not found");

		const updateData: Record<string, unknown> = { updatedAt: new Date() };

		if (fields.customerId !== undefined) updateData.customerId = fields.customerId;
		if (fields.addressId !== undefined) updateData.addressId = fields.addressId;
		if (fields.notes !== undefined) updateData.notes = fields.notes;
		if (fields.kerryTracking !== undefined) updateData.kerryTracking = fields.kerryTracking;

		// Replace items when provided: delete existing, insert new
		let newSubtotal: number | undefined;
		if (fields.items !== undefined) {
			await db.delete(orderItems).where(eq(orderItems.orderId, id));
			await db.insert(orderItems).values(
				fields.items.map((item) => ({
					orderId: id,
					roundProductId: item.roundProductId,
					quantity: item.quantity,
					unitPriceThb: item.unitPriceThb.toFixed(2),
					lineTotalThb: (item.unitPriceThb * item.quantity).toFixed(2),
				})),
			);
			newSubtotal = fields.items.reduce(
				(sum, item) => sum + item.unitPriceThb * item.quantity,
				0,
			);
			updateData.subtotalThb = newSubtotal.toFixed(2);
		}

		// Recompute total when either subtotal or shipping fee changes
		const subtotal = newSubtotal ?? Number(current.subtotalThb);
		const shipping = fields.shippingFeeThb ?? Number(current.shippingFeeThb);

		if (fields.shippingFeeThb !== undefined) {
			updateData.shippingFeeThb = shipping.toFixed(2);
		}

		if (newSubtotal !== undefined || fields.shippingFeeThb !== undefined) {
			updateData.totalThb = (subtotal + shipping).toFixed(2);
		}

		const [updated] = await db
			.update(orders)
			.set(updateData)
			.where(eq(orders.id, id))
			.returning();

		if (!updated) throw new Error("Order not found");

		// Keep customer's last_ordered_at fresh when customer changes
		if (fields.customerId !== undefined) {
			await db
				.update(customers)
				.set({ lastOrderedAt: new Date() })
				.where(eq(customers.id, fields.customerId));
		}

		await writeAudit({
			userId: session.user.id,
			entity: "order",
			entityId: id,
			action: "update",
			diff: { ...fields, itemCount: fields.items?.length },
		});

		return updated;
	});
