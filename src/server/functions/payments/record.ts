import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { db } from "#/db/index";
import { orderPayments, orders } from "#/db/schema";
import { writeAudit } from "#/server/audit";
import { requireSession } from "#/server/middleware";
import { recordPaymentSchema } from "#/shared/schemas/payment";

function computePaymentStatus(paidAmount: number, totalThb: number): string {
	if (paidAmount <= 0) return "pending";
	if (paidAmount >= totalThb) return "paid";
	return "partial";
}

export const recordPayment = createServerFn({ method: "POST" })
	.inputValidator(recordPaymentSchema)
	.handler(async ({ data }) => {
		const session = await requireSession();

		const [order] = await db
			.select({ id: orders.id, totalThb: orders.totalThb })
			.from(orders)
			.where(eq(orders.id, data.orderId))
			.limit(1);
		if (!order) throw new Error("Order not found");

		await db.insert(orderPayments).values({
			orderId: data.orderId,
			amountThb: data.amountThb.toFixed(2),
			type: data.type,
			method: data.method ?? null,
			notes: data.notes ?? null,
			recordedBy: session.user.id,
		});

		// Recompute paid_amount_thb — refunds reduce the total
		const allPayments = await db
			.select({ amountThb: orderPayments.amountThb, type: orderPayments.type })
			.from(orderPayments)
			.where(eq(orderPayments.orderId, data.orderId));

		const paidAmount = allPayments.reduce((acc, p) => {
			const amount = Number(p.amountThb);
			return p.type === "refund" ? acc - amount : acc + amount;
		}, 0);

		const totalThb = Number(order.totalThb);
		const paymentStatus = computePaymentStatus(paidAmount, totalThb);

		const [updated] = await db
			.update(orders)
			.set({
				paidAmountThb: paidAmount.toFixed(2),
				paymentStatus,
				updatedAt: new Date(),
			})
			.where(eq(orders.id, data.orderId))
			.returning();

		await writeAudit({
			userId: session.user.id,
			entity: "order_payment",
			entityId: data.orderId,
			action: "record",
			diff: { amount: data.amountThb, type: data.type, paymentStatus },
		});

		return updated;
	});
