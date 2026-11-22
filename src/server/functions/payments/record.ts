import { createServerFn } from "@tanstack/react-start";
import { and, eq, sql } from "drizzle-orm";
import { db } from "#/db/index";
import { orderPayments, orders } from "#/db/schema";
import { writeAudit } from "#/server/audit";
import { requireSession } from "#/server/middleware";
import { getEffectivePaymentStatus } from "#/shared/payment-status";
import {
	deletePaymentSchema,
	recordPaymentSchema,
} from "#/shared/schemas/payment";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function lockOrder(tx: Transaction, orderId: string) {
	const [order] = await tx
		.select({
			id: orders.id,
			totalThb: orders.totalThb,
			paidAmountThb: orders.paidAmountThb,
			paymentStatus: orders.paymentStatus,
		})
		.from(orders)
		.where(eq(orders.id, orderId))
		.for("no key update");
	if (!order) throw new Error("Order not found");
	return order;
}

async function reconcilePayments(
	tx: Transaction,
	order: Awaited<ReturnType<typeof lockOrder>>,
) {
	const [{ paidAmountThb }] = await tx
		.select({
			paidAmountThb: sql<string>`coalesce(sum(
				case when ${orderPayments.type} = 'refund' then -${orderPayments.amountThb}
				else ${orderPayments.amountThb} end
			), 0)`,
		})
		.from(orderPayments)
		.where(eq(orderPayments.orderId, order.id));

	const [updated] = await tx
		.update(orders)
		.set({
			paidAmountThb,
			paymentStatus: getEffectivePaymentStatus(
				"pending",
				Number(paidAmountThb),
				Number(order.totalThb),
			),
			updatedAt: new Date(),
		})
		.where(eq(orders.id, order.id))
		.returning();
	return updated;
}

export const recordPayment = createServerFn({ method: "POST" })
	.validator(recordPaymentSchema)
	.handler(async ({ data }) => {
		const session = await requireSession();

		const updated = await db.transaction(async (tx) => {
			const order = await lockOrder(tx, data.orderId);

			await tx.insert(orderPayments).values({
				orderId: data.orderId,
				amountThb: data.amountThb.toFixed(2),
				type: data.type,
				method: data.method ?? null,
				notes: data.notes ?? null,
				recordedBy: session.user.id,
			});

			return reconcilePayments(tx, order);
		});

		await writeAudit({
			userId: session.user.id,
			entity: "order_payment",
			entityId: data.orderId,
			action: "record",
			diff: {
				amount: data.amountThb,
				type: data.type,
				paymentStatus: updated.paymentStatus,
			},
		});

		return updated;
	});

export const deletePayment = createServerFn({ method: "POST" })
	.validator(deletePaymentSchema)
	.handler(async ({ data }) => {
		const session = await requireSession();

		return db.transaction(async (tx) => {
			const order = await lockOrder(tx, data.orderId);
			const [payment] = await tx
				.delete(orderPayments)
				.where(
					and(
						eq(orderPayments.id, data.paymentId),
						eq(orderPayments.orderId, order.id),
					),
				)
				.returning();

			const { paidAmountThb, paymentStatus } = payment
				? await reconcilePayments(tx, order)
				: order;
			if (payment) {
				await writeAudit(
					{
						userId: session.user.id,
						entity: "order_payment",
						entityId: order.id,
						action: "delete",
						diff: { payment, paymentStatus },
					},
					tx,
				);
			}

			const payments = await tx
				.select()
				.from(orderPayments)
				.where(eq(orderPayments.orderId, order.id))
				.orderBy(orderPayments.paidAt);
			return { paidAmountThb, paymentStatus, payments };
		});
	});
