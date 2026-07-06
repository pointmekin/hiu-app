import { createServerFn } from "@tanstack/react-start";
import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { db } from "#/db/index";
import { orderItems, roundProducts } from "#/db/schema";
import { writeAudit } from "#/server/audit";
import { requireSession } from "#/server/middleware";
import { upsertRoundProductsSchema } from "#/shared/schemas/round-product";

export const upsertRoundProducts = createServerFn({ method: "POST" })
	.inputValidator(upsertRoundProductsSchema)
	.handler(async ({ data }) => {
		const session = await requireSession();

		const incomingProductIds = data.rows.map((row) => row.productId);

		const rows = data.rows.map((row) => ({
			roundId: data.roundId,
			productId: row.productId,
			foreignPrice: String(row.foreignPrice),
			sellPriceThb: String(row.sellPriceThb),
			priceOverridden: row.priceOverridden,
			storeLocation: row.storeLocation ?? null,
			notes: row.notes ?? null,
		}));

		let deletedCount = 0;
		// The removal check, RESTRICT guard, delete, and upsert must all run in
		// one transaction. Splitting them leaves a window where a failed upsert
		// (e.g. a dropped Neon connection) commits the deletes but loses the
		// price edits — a silent partial write.
		const result = await db.transaction(async (tx) => {
			// Rows currently in this round whose productId is absent from the
			// payload are ones the user removed in the editor. They must be deleted
			// — an upsert-only flow leaves them in place and they reappear on refetch.
			const removed = await tx
				.select({ id: roundProducts.id })
				.from(roundProducts)
				.where(
					and(
						eq(roundProducts.roundId, data.roundId),
						incomingProductIds.length > 0
							? notInArray(roundProducts.productId, incomingProductIds)
							: undefined,
					),
				);

			if (removed.length > 0) {
				const removedIds = removed.map((r) => r.id);

				// order_items.round_product_id is ON DELETE RESTRICT. Surface a
				// friendly error instead of letting a cryptic FK violation bubble up.
				const referenced = await tx
					.select({ id: orderItems.roundProductId })
					.from(orderItems)
					.where(inArray(orderItems.roundProductId, removedIds))
					.limit(1);

				if (referenced.length > 0) {
					throw new Error(
						"Cannot remove a product that already appears on an order. Remove the order items first.",
					);
				}

				await tx
					.delete(roundProducts)
					.where(inArray(roundProducts.id, removedIds));
				deletedCount = removed.length;
			}

			return rows.length
				? await tx
						.insert(roundProducts)
						.values(rows)
						.onConflictDoUpdate({
							target: [roundProducts.roundId, roundProducts.productId],
							set: {
								foreignPrice: sql`excluded.foreign_price`,
								sellPriceThb: sql`excluded.sell_price_thb`,
								priceOverridden: sql`excluded.price_overridden`,
								storeLocation: sql`excluded.store_location`,
								notes: sql`excluded.notes`,
							},
						})
						.returning()
				: [];
		});

		await writeAudit({
			userId: session.user.id,
			entity: "round_products",
			entityId: data.roundId,
			action: "upsert_many",
			diff: { count: result.length, deleted: deletedCount },
		});

		return result;
	});
