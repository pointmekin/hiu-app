import { createServerFn } from "@tanstack/react-start";
import { desc, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db/index";
import { products } from "#/db/schema";
import { requireSession } from "#/server/middleware";
import { s3PublicUrl } from "#/server/s3";

export const listProducts = createServerFn({ method: "GET" })
	.inputValidator(
		z.object({ q: z.string().optional(), limit: z.coerce.number().default(50) }),
	)
	.handler(async ({ data }) => {
		await requireSession();

		const rows = await (data.q?.trim()
			? db
					.select()
					.from(products)
					.where(
						or(
							ilike(products.name, `%${data.q.trim()}%`),
							ilike(products.brand, `%${data.q.trim()}%`),
							ilike(products.category, `%${data.q.trim()}%`),
						),
					)
					.orderBy(desc(products.lastUsedAt))
					.limit(data.limit)
			: db
					.select()
					.from(products)
					.orderBy(desc(products.lastUsedAt))
					.limit(data.limit));

		return rows.map((p) => ({
			...p,
			thumbUrl: s3PublicUrl(p.thumbKey),
			imageUrl: s3PublicUrl(p.imageKey),
		}));
	});
