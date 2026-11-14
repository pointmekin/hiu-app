import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db/index";
import { products, roundProducts, rounds } from "#/db/schema";
import { writeAudit } from "#/server/audit";
import { requireSession } from "#/server/middleware";
import { s3PublicUrl } from "#/server/s3";
import { resolveCarryOverPrice } from "#/shared/pricing";

export const addProductFromCatalog = createServerFn({ method: "POST" })
	.validator(
		z.object({
			roundId: z.string().uuid(),
			productId: z.string().uuid(),
		}),
	)
	.handler(async ({ data }) => {
		const session = await requireSession();

		const [round] = await db
			.select()
			.from(rounds)
			.where(eq(rounds.id, data.roundId))
			.limit(1);
		if (!round) throw new Error("Round not found");

		const [product] = await db
			.select()
			.from(products)
			.where(eq(products.id, data.productId))
			.limit(1);
		if (!product) throw new Error("Product not found");

		const toResult = (rp: typeof roundProducts.$inferSelect) => ({
			id: rp.id,
			productId: product.id,
			productName: product.name,
			productBrand: product.brand,
			productThumbUrl: s3PublicUrl(product.thumbKey),
			sellPriceThb: rp.sellPriceThb,
		});

		const [last] = await db
			.select({
				foreignPrice: roundProducts.foreignPrice,
				sellPriceThb: roundProducts.sellPriceThb,
				sourceCurrency: rounds.sourceCurrency,
			})
			.from(roundProducts)
			.innerJoin(rounds, eq(rounds.id, roundProducts.roundId))
			.where(
				and(
					eq(roundProducts.productId, data.productId),
					ne(roundProducts.roundId, data.roundId),
				),
			)
			.orderBy(desc(roundProducts.createdAt))
			.limit(1);

		const price = resolveCarryOverPrice(
			{
				defaultPriceThb:
					product.defaultPriceThb == null
						? null
						: Number(product.defaultPriceThb),
				lastForeignPrice: last ? Number(last.foreignPrice) : null,
				lastSellPriceThb: last ? Number(last.sellPriceThb) : null,
				lastSourceCurrency: last?.sourceCurrency ?? null,
			},
			{
				sourceCurrency: round.sourceCurrency,
				fxRate: Number(round.fxRate),
				perItemFee: Number(round.perItemFeeTh),
			},
		);

		const [inserted] = await db
			.insert(roundProducts)
			.values({
				roundId: data.roundId,
				productId: data.productId,
				foreignPrice: String(price.foreignPrice),
				sellPriceThb: String(price.sellPriceThb),
				priceOverridden: price.priceOverridden,
			})
			.onConflictDoNothing({
				target: [roundProducts.roundId, roundProducts.productId],
			})
			.returning();

		// The product is already in this round (another tab or a parallel request).
		if (!inserted) {
			const [existing] = await db
				.select()
				.from(roundProducts)
				.where(
					and(
						eq(roundProducts.roundId, data.roundId),
						eq(roundProducts.productId, data.productId),
					),
				)
				.limit(1);
			return toResult(existing);
		}

		await writeAudit({
			userId: session.user.id,
			entity: "round_product",
			entityId: inserted.id,
			action: "create_from_catalog",
			diff: {
				roundId: data.roundId,
				productId: data.productId,
				...price,
			},
		});

		return toResult(inserted);
	});
