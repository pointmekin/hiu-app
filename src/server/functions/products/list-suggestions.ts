import { createServerFn } from "@tanstack/react-start";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db/index";
import { requireSession } from "#/server/middleware";
import { s3PublicUrl } from "#/server/s3";

const DEFAULT_LIMIT = 30;

interface SuggestionRow {
	id: string;
	name: string;
	brand: string | null;
	source_country: string | null;
	default_price_thb: string | null;
	thumb_key: string | null;
	last_sell_price_thb: string | null;
	last_foreign_price: string | null;
	last_source_currency: string | null;
}

function toNumberOrNull(value: string | null): number | null {
	return value == null ? null : Number(value);
}

function mapRow(row: SuggestionRow) {
	return {
		id: row.id,
		name: row.name,
		brand: row.brand,
		sourceCountry: row.source_country,
		thumbUrl: s3PublicUrl(row.thumb_key),
		defaultPriceThb: toNumberOrNull(row.default_price_thb),
		lastSellPriceThb: toNumberOrNull(row.last_sell_price_thb),
		lastForeignPrice: toNumberOrNull(row.last_foreign_price),
		lastSourceCurrency: row.last_source_currency,
	};
}

export type ProductSuggestion = ReturnType<typeof mapRow>;

/**
 * Catalog products not yet in this round, with the price from their latest use
 * in another round.
 * Products used most recently come first, so items from the previous round
 * are at the top when the query is empty.
 */
export const listProductSuggestions = createServerFn({ method: "GET" })
	.validator(
		z.object({
			roundId: z.string().uuid(),
			q: z.string().optional(),
			limit: z.coerce.number().int().min(1).max(100).default(DEFAULT_LIMIT),
		}),
	)
	.handler(async ({ data }) => {
		await requireSession();
		const q = data.q?.trim() ?? "";
		const queryWrap = `%${q}%`;

		const searchFilter = q
			? sql`and (p.name ilike ${queryWrap}
			     or p.brand ilike ${queryWrap}
			     or p.name % ${q}
			     or coalesce(p.brand, '') % ${q})`
			: sql``;
		const searchOrder = q
			? sql`greatest(similarity(p.name, ${q}), similarity(coalesce(p.brand, ''), ${q})) desc,`
			: sql``;

		const result = await db.execute(sql`
			select p.id, p.name, p.brand, p.source_country, p.default_price_thb, p.thumb_key,
			       last_rp.sell_price_thb as last_sell_price_thb,
			       last_rp.foreign_price as last_foreign_price,
			       last_rp.source_currency as last_source_currency
			from products p
			left join lateral (
				select rp.sell_price_thb, rp.foreign_price, r.source_currency, rp.created_at
				from round_products rp
				join rounds r on r.id = rp.round_id
				where rp.product_id = p.id and rp.round_id <> ${data.roundId}
				order by rp.created_at desc
				limit 1
			) last_rp on true
			where not exists (
				select 1 from round_products cur
				where cur.product_id = p.id and cur.round_id = ${data.roundId}
			)
			${searchFilter}
			order by ${searchOrder} last_rp.created_at desc nulls last, p.name
			limit ${data.limit}
		`);

		return (result.rows as unknown as SuggestionRow[]).map(mapRow);
	});
