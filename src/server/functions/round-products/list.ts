import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db/index";
import { products, roundProducts } from "#/db/schema";
import { requireSession } from "#/server/middleware";
import { s3PublicUrl } from "#/server/s3";

export const listRoundProducts = createServerFn({ method: "GET" })
	.inputValidator(z.object({ roundId: z.string().uuid() }))
	.handler(async ({ data }) => {
		await requireSession();

		const rows = await db
			.select({
				id: roundProducts.id,
				roundId: roundProducts.roundId,
				productId: roundProducts.productId,
				foreignPrice: roundProducts.foreignPrice,
				sellPriceThb: roundProducts.sellPriceThb,
				priceOverridden: roundProducts.priceOverridden,
				storeLocation: roundProducts.storeLocation,
				notes: roundProducts.notes,
				createdAt: roundProducts.createdAt,
				productName: products.name,
				productBrand: products.brand,
				productCategory: products.category,
				productThumbKey: products.thumbKey,
			})
			.from(roundProducts)
			.innerJoin(products, eq(roundProducts.productId, products.id))
			.where(eq(roundProducts.roundId, data.roundId))
			.orderBy(products.name);

		return rows.map((r) => ({ ...r, productThumbUrl: s3PublicUrl(r.productThumbKey) }));
	});

export type RoundProductWithProduct = Awaited<
	ReturnType<typeof listRoundProducts>
>[number];
