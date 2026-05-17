import { createServerFn } from "@tanstack/react-start";
import { sql } from "drizzle-orm";
import { db } from "#/db/index";
import { roundProducts } from "#/db/schema";
import { writeAudit } from "#/server/audit";
import { requireSession } from "#/server/middleware";
import { upsertRoundProductsSchema } from "#/shared/schemas/round-product";

export const upsertRoundProducts = createServerFn({ method: "POST" })
	.inputValidator(upsertRoundProductsSchema)
	.handler(async ({ data }) => {
		const session = await requireSession();

		const rows = data.rows.map((row) => ({
			roundId: data.roundId,
			productId: row.productId,
			foreignPrice: String(row.foreignPrice),
			sellPriceThb: String(row.sellPriceThb),
			priceOverridden: row.priceOverridden,
			storeLocation: row.storeLocation ?? null,
			notes: row.notes ?? null,
		}));

		const result = await db
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
			.returning();

		await writeAudit({
			userId: session.user.id,
			entity: "round_products",
			entityId: data.roundId,
			action: "upsert_many",
			diff: { count: result.length },
		});

		return result;
	});
