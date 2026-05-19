import { createServerFn } from "@tanstack/react-start";
import { type SQL, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db/index";
import { requireSession } from "#/server/middleware";
import { s3PublicUrl } from "#/server/s3";

const PAGE_SIZE = 20;

interface ProductRow {
	id: string;
	name: string;
	brand: string | null;
	source_country: string | null;
	category: string | null;
	image_key: string | null;
	thumb_key: string | null;
	last_used_at: string | null;
	created_at: string;
}

function mapRow(p: ProductRow) {
	return {
		id: p.id,
		name: p.name,
		brand: p.brand,
		sourceCountry: p.source_country,
		category: p.category,
		imageKey: p.image_key,
		thumbKey: p.thumb_key,
		lastUsedAt: p.last_used_at,
		createdAt: p.created_at,
		thumbUrl: s3PublicUrl(p.thumb_key),
		imageUrl: s3PublicUrl(p.image_key),
	};
}

function buildFilterAnd(
	brand?: string,
	category?: string,
	sourceCountry?: string,
): SQL {
	const clauses: SQL[] = [];
	if (brand) clauses.push(sql`brand = ${brand}`);
	if (category) clauses.push(sql`category = ${category}`);
	if (sourceCountry) clauses.push(sql`source_country = ${sourceCountry}`);
	if (clauses.length === 0) return sql``;
	return sql` and ${sql.join(clauses, sql` and `)}`;
}

function buildFilterWhere(
	brand?: string,
	category?: string,
	sourceCountry?: string,
): SQL {
	const clauses: SQL[] = [];
	if (brand) clauses.push(sql`brand = ${brand}`);
	if (category) clauses.push(sql`category = ${category}`);
	if (sourceCountry) clauses.push(sql`source_country = ${sourceCountry}`);
	if (clauses.length === 0) return sql``;
	return sql`where ${sql.join(clauses, sql` and `)}`;
}

const cursorSchema = z.object({
	lastUsedAt: z.string().nullable(),
	id: z.string().uuid(),
});

export type ProductListCursor = z.infer<typeof cursorSchema>;
export type ProductListItem = ReturnType<typeof mapRow>;

export const listProducts = createServerFn({ method: "GET" })
	.inputValidator(
		z.object({
			q: z.string().optional(),
			limit: z.coerce.number().default(PAGE_SIZE),
			cursor: cursorSchema.optional(),
			brand: z.string().optional(),
			category: z.string().optional(),
			sourceCountry: z.string().optional(),
		}),
	)
	.handler(async ({ data }) => {
		await requireSession();
		const limit = data.limit;
		const { brand, category, sourceCountry } = data;

		// Search path — text match + optional filters, no cursor pagination
		if (data.q?.trim()) {
			const q = data.q.trim();
			const queryWrap = `%${q}%`;
			const filterAnd = buildFilterAnd(brand, category, sourceCountry);
			const rows = await db.execute(sql`
				select id, name, brand, source_country, category, image_key, thumb_key, last_used_at, created_at
				from products
				where (name ilike ${queryWrap}
				   or brand ilike ${queryWrap}
				   or category ilike ${queryWrap}
				   or name % ${q}
				   or coalesce(brand, '') % ${q}
				   or coalesce(category, '') % ${q})
				${filterAnd}
				order by greatest(
				           similarity(name, ${q}),
				           similarity(coalesce(brand, ''), ${q}),
				           similarity(coalesce(category, ''), ${q})
				         ) desc,
				         last_used_at desc nulls last
				limit ${limit}
			`);
			return {
				items: (rows.rows as unknown as ProductRow[]).map(mapRow),
				nextCursor: null,
			};
		}

		// Browse path — keyset cursor pagination + optional filters
		const fetchLimit = limit + 1;
		let rows: Awaited<ReturnType<typeof db.execute>>;

		if (!data.cursor) {
			const filterWhere = buildFilterWhere(brand, category, sourceCountry);
			rows = await db.execute(sql`
				select id, name, brand, source_country, category, image_key, thumb_key, last_used_at, created_at
				from products
				${filterWhere}
				order by last_used_at desc nulls last, id
				limit ${fetchLimit}
			`);
		} else if (data.cursor.lastUsedAt !== null) {
			const cursorTs = data.cursor.lastUsedAt;
			const cursorId = data.cursor.id;
			const filterAnd = buildFilterAnd(brand, category, sourceCountry);
			rows = await db.execute(sql`
				select id, name, brand, source_country, category, image_key, thumb_key, last_used_at, created_at
				from products
				where (last_used_at < ${cursorTs}::timestamptz
				   or (last_used_at = ${cursorTs}::timestamptz and id > ${cursorId})
				   or last_used_at is null)
				${filterAnd}
				order by last_used_at desc nulls last, id
				limit ${fetchLimit}
			`);
		} else {
			const cursorId = data.cursor.id;
			const filterAnd = buildFilterAnd(brand, category, sourceCountry);
			rows = await db.execute(sql`
				select id, name, brand, source_country, category, image_key, thumb_key, last_used_at, created_at
				from products
				where (last_used_at is null and id > ${cursorId})
				${filterAnd}
				order by last_used_at desc nulls last, id
				limit ${fetchLimit}
			`);
		}

		const all = rows.rows as unknown as ProductRow[];
		const hasMore = all.length > limit;
		const page = hasMore ? all.slice(0, limit) : all;
		const items = page.map(mapRow);
		const last = page[page.length - 1];

		return {
			items,
			nextCursor:
				hasMore && last
					? { lastUsedAt: last.last_used_at ?? null, id: last.id }
					: null,
		};
	});
