import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db/index";
import { products } from "#/db/schema";
import { requireSession } from "#/server/middleware";
import { s3PublicUrl } from "#/server/s3";

export const getProduct = createServerFn({ method: "GET" })
	.inputValidator(z.object({ id: z.string().uuid() }))
	.handler(async ({ data }) => {
		await requireSession();

		const [p] = await db
			.select()
			.from(products)
			.where(eq(products.id, data.id));

		if (!p) throw new Error("Product not found");

		return {
			id: p.id,
			name: p.name,
			brand: p.brand,
			sourceCountry: p.sourceCountry,
			category: p.category,
			imageKey: p.imageKey,
			thumbKey: p.thumbKey,
			lastUsedAt: p.lastUsedAt,
			createdAt: p.createdAt,
			thumbUrl: s3PublicUrl(p.thumbKey),
			imageUrl: s3PublicUrl(p.imageKey),
		};
	});
