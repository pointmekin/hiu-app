import { createServerFn } from "@tanstack/react-start";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db/index";
import { requireSession } from "#/server/middleware";
import { s3PublicUrl } from "#/server/s3";

interface ProductRow {
	id: string;
	name: string;
	brand: string | null;
	source_country: string | null;
	category: string | null;
	image_key: string | null;
	thumb_key: string | null;
	last_used_at: Date | null;
	created_at: Date;
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

export const listProducts = createServerFn({ method: "GET" })
	.inputValidator(
		z.object({ q: z.string().optional(), limit: z.coerce.number().default(50) }),
	)
	.handler(async ({ data }) => {
		await requireSession();

		if (!data.q?.trim()) {
			const rows = await db.execute(sql`
				select id, name, brand, source_country, category, image_key, thumb_key, last_used_at, created_at
				from products
				order by last_used_at desc nulls last
				limit ${data.limit}
			`);
			return (rows.rows as unknown as ProductRow[]).map(mapRow);
		}

		const q = data.q.trim();
		const queryWrap = `%${q}%`;
		const rows = await db.execute(sql`
			select id, name, brand, source_country, category, image_key, thumb_key, last_used_at, created_at
			from products
			where name ilike ${queryWrap}
			   or brand ilike ${queryWrap}
			   or category ilike ${queryWrap}
			   or name % ${q}
			   or coalesce(brand, '') % ${q}
			   or coalesce(category, '') % ${q}
			order by greatest(
			           similarity(name, ${q}),
			           similarity(coalesce(brand, ''), ${q}),
			           similarity(coalesce(category, ''), ${q})
			         ) desc,
			         last_used_at desc nulls last
			limit ${data.limit}
		`);

		return (rows.rows as unknown as ProductRow[]).map(mapRow);
	});
