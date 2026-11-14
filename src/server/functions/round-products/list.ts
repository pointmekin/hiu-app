import { createServerFn } from "@tanstack/react-start";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db/index";
import { products, roundProducts, rounds } from "#/db/schema";
import { requireSession } from "#/server/middleware";
import { s3PublicUrl } from "#/server/s3";

export const listRoundProducts = createServerFn({ method: "GET" })
	.validator(z.object({ roundId: z.string().uuid() }))
	.handler(async ({ data }) => {
		await requireSession();

		const rows = await db
			.select({
				id: roundProducts.id,
				productId: roundProducts.productId,
				foreignPrice: roundProducts.foreignPrice,
				sellPriceThb: roundProducts.sellPriceThb,
				priceOverridden: roundProducts.priceOverridden,
				storeLocation: roundProducts.storeLocation,
				productName: products.name,
				productBrand: products.brand,
				productSourceCountry: sql<
					string | null
				>`coalesce(${products.sourceCountry}, ${rounds.country})`,
				productThumbKey: products.thumbKey,
			})
			.from(roundProducts)
			.innerJoin(products, eq(roundProducts.productId, products.id))
			.innerJoin(rounds, eq(roundProducts.roundId, rounds.id))
			.where(eq(roundProducts.roundId, data.roundId))
			.orderBy(products.name);

		return rows.map(({ productThumbKey, ...r }) => ({
			...r,
			productThumbUrl: s3PublicUrl(productThumbKey),
		}));
	});

export type RoundProductWithProduct = Awaited<
	ReturnType<typeof listRoundProducts>
>[number];
