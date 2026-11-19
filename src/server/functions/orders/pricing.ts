import { and, eq, inArray, sql } from "drizzle-orm";
import type { db } from "#/db/index";
import { orderItems, orders, roundProducts, rounds } from "#/db/schema";
import type { OrderItemInput } from "#/shared/schemas/order";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Serialize order writes and price changes for the same round.
export async function lockRound(tx: Transaction, roundId: string) {
	const [round] = await tx
		.select({ fxRate: rounds.fxRate, perItemFeeTh: rounds.perItemFeeTh })
		.from(rounds)
		.where(eq(rounds.id, roundId))
		.for("no key update");

	if (!round) throw new Error("Round not found");
	return round;
}

export async function priceOrderItems(
	tx: Transaction,
	roundId: string,
	items: OrderItemInput[],
) {
	const products = await tx
		.select({ id: roundProducts.id, price: roundProducts.sellPriceThb })
		.from(roundProducts)
		.where(
			and(
				eq(roundProducts.roundId, roundId),
				inArray(
					roundProducts.id,
					items.map((item) => item.roundProductId),
				),
			),
		);
	const prices = new Map(products.map(({ id, price }) => [id, price]));

	return items.map(({ roundProductId, quantity }) => {
		const unitPriceThb = prices.get(roundProductId);
		if (unitPriceThb === undefined) {
			throw new Error("Order item product does not belong to the round");
		}

		return {
			roundProductId,
			quantity,
			unitPriceThb,
			lineTotalThb: (Number(unitPriceThb) * quantity).toFixed(2),
		};
	});
}

export async function syncOrderPrices(
	tx: Transaction,
	roundProductIds: string[],
) {
	if (roundProductIds.length === 0) return;

	const changedItems = await tx
		.update(orderItems)
		.set({
			unitPriceThb: sql`${roundProducts.sellPriceThb}`,
			lineTotalThb: sql`${roundProducts.sellPriceThb} * ${orderItems.quantity}`,
		})
		.from(roundProducts)
		.where(
			and(
				eq(orderItems.roundProductId, roundProducts.id),
				inArray(roundProducts.id, roundProductIds),
				sql`${orderItems.unitPriceThb} <> ${roundProducts.sellPriceThb}`,
			),
		)
		.returning({ orderId: orderItems.orderId });

	if (changedItems.length === 0) return;

	const orderIds = [...new Set(changedItems.map(({ orderId }) => orderId))];
	const subtotals = tx
		.select({
			orderId: orderItems.orderId,
			subtotal: sql`sum(${orderItems.lineTotalThb})`.as("subtotal"),
		})
		.from(orderItems)
		.where(inArray(orderItems.orderId, orderIds))
		.groupBy(orderItems.orderId)
		.as("subtotals");
	const total = sql`${subtotals.subtotal} + ${orders.shippingFeeThb}`;

	await tx
		.update(orders)
		.set({
			subtotalThb: sql`${subtotals.subtotal}`,
			totalThb: total,
			// Match getEffectivePaymentStatus using the current order row.
			paymentStatus: sql`case
				when ${orders.paymentStatus} = 'refunded' then 'refunded'
				when ${orders.paidAmountThb} <= 0 then 'pending'
				when ${orders.paidAmountThb} >= ${total} then 'paid'
				else 'partial'
			end`,
			updatedAt: new Date(),
		})
		.from(subtotals)
		.where(eq(orders.id, subtotals.orderId));
}
