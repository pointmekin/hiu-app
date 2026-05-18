import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { db } from "#/db/index";
import { orders } from "#/db/schema";
import { writeAudit } from "#/server/audit";
import { requireSession } from "#/server/middleware";
import { updateOrderSchema } from "#/shared/schemas/order";

export const updateOrder = createServerFn({ method: "POST" })
	.inputValidator(updateOrderSchema)
	.handler(async ({ data }) => {
		const session = await requireSession();

		const { id, ...fields } = data;
		const updateData: Record<string, unknown> = {};
		if (fields.addressId !== undefined) updateData.addressId = fields.addressId;
		if (fields.shippingFeeThb !== undefined) {
			updateData.shippingFeeThb = fields.shippingFeeThb.toFixed(2);
		}
		if (fields.notes !== undefined) updateData.notes = fields.notes;
		if (fields.kerryTracking !== undefined) updateData.kerryTracking = fields.kerryTracking;
		updateData.updatedAt = new Date();

		// Recompute total if shipping fee changed
		if (fields.shippingFeeThb !== undefined) {
			const [current] = await db
				.select({ subtotalThb: orders.subtotalThb })
				.from(orders)
				.where(eq(orders.id, id))
				.limit(1);
			if (current) {
				const subtotal = Number(current.subtotalThb);
				updateData.totalThb = (subtotal + fields.shippingFeeThb).toFixed(2);
			}
		}

		const [updated] = await db
			.update(orders)
			.set(updateData)
			.where(eq(orders.id, id))
			.returning();

		if (!updated) throw new Error("Order not found");

		await writeAudit({
			userId: session.user.id,
			entity: "order",
			entityId: id,
			action: "update",
			diff: fields,
		});

		return updated;
	});
