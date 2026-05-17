import { createServerFn } from "@tanstack/react-start";
import { desc, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db/index";
import { products } from "#/db/schema";
import { requireSession } from "#/server/middleware";

export const listProducts = createServerFn({ method: "GET" })
	.inputValidator(
		z.object({ q: z.string().optional(), limit: z.coerce.number().default(50) }),
	)
	.handler(async ({ data }) => {
		await requireSession();

		if (data.q?.trim()) {
			const term = `%${data.q.trim()}%`;
			return db
				.select()
				.from(products)
				.where(
					or(
						ilike(products.name, term),
						ilike(products.brand, term),
						ilike(products.category, term),
					),
				)
				.orderBy(desc(products.lastUsedAt))
				.limit(data.limit);
		}

		return db
			.select()
			.from(products)
			.orderBy(desc(products.lastUsedAt))
			.limit(data.limit);
	});
