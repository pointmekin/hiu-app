import { createServerFn } from "@tanstack/react-start";
import { and, eq, exists, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db/index";
import { customerAddresses, customers, orderItems, orders } from "#/db/schema";
import { writeAudit } from "#/server/audit";
import { requireSession } from "#/server/middleware";
import { getEffectivePaymentStatus } from "#/shared/payment-status";
import { updateOrderSchema } from "#/shared/schemas/order";
import { lockRound, priceOrderItems } from "./pricing";

export const updateOrder = createServerFn({ method: "POST" })
	.validator(updateOrderSchema)
	.handler(async ({ data }) => {
		const session = await requireSession();
		const { id, ...fields } = data;

		const updated = await db.transaction(async (tx) => {
			const [order] = await tx
				.select({ roundId: orders.roundId })
				.from(orders)
				.where(eq(orders.id, id));
			if (!order) throw new Error("Order not found");

			await lockRound(tx, order.roundId);
			const [current] = await tx
				.select({
					subtotalThb: orders.subtotalThb,
					shippingFeeThb: orders.shippingFeeThb,
					paidAmountThb: orders.paidAmountThb,
					paymentStatus: orders.paymentStatus,
				})
				.from(orders)
				.where(eq(orders.id, id))
				.for("no key update");

			if (!current) throw new Error("Order not found");

			const updateData: Record<string, unknown> = { updatedAt: new Date() };

			if (fields.customerId !== undefined)
				updateData.customerId = fields.customerId;
			if (fields.addressId !== undefined)
				updateData.addressId = fields.addressId;
			if (fields.notes !== undefined) updateData.notes = fields.notes;
			if (fields.kerryTracking !== undefined)
				updateData.kerryTracking = fields.kerryTracking;
			if (fields.isPacked !== undefined) updateData.isPacked = fields.isPacked;

			// Replace items when provided: delete existing, insert new
			let newSubtotal: number | undefined;
			if (fields.items !== undefined) {
				const items = await priceOrderItems(tx, order.roundId, fields.items);
				await tx.delete(orderItems).where(eq(orderItems.orderId, id));
				await tx
					.insert(orderItems)
					.values(items.map((item) => ({ ...item, orderId: id })));
				newSubtotal = items.reduce(
					(sum, item) => sum + Number(item.lineTotalThb),
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
				const total = subtotal + shipping;
				updateData.totalThb = total.toFixed(2);
				updateData.paymentStatus = getEffectivePaymentStatus(
					current.paymentStatus,
					Number(current.paidAmountThb),
					total,
				);
			}

			const [updated] = await tx
				.update(orders)
				.set(updateData)
				.where(eq(orders.id, id))
				.returning();

			if (!updated) throw new Error("Order not found");

			return updated;
		});

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

export const saveDefaultOrderAddress = createServerFn({ method: "POST" })
	.validator(
		updateOrderSchema.pick({ id: true }).extend({
			customerId: z.string().uuid(),
			addressId: z.string().uuid(),
		}),
	)
	.handler(async ({ data: { id, customerId, addressId } }) => {
		const session = await requireSession();
		const defaultAddress = db
			.select({ id: customerAddresses.id })
			.from(customerAddresses)
			.where(
				and(
					eq(customerAddresses.id, addressId),
					eq(customerAddresses.customerId, customerId),
					eq(customerAddresses.isDefault, true),
				),
			);

		const [updated] = await db
			.update(orders)
			.set({ addressId, updatedAt: new Date() })
			.where(
				and(
					eq(orders.id, id),
					eq(orders.customerId, customerId),
					isNull(orders.addressId),
					ne(orders.status, "cancelled"),
					exists(defaultAddress),
				),
			)
			.returning({ id: orders.id });

		if (updated) {
			await writeAudit({
				userId: session.user.id,
				entity: "order",
				entityId: id,
				action: "update",
				diff: { addressId },
			});
		}

		return !!updated;
	});
