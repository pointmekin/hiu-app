import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db/index";
import { products, roundProducts, rounds } from "#/db/schema";
import { writeAudit } from "#/server/audit";
import { requireSession } from "#/server/middleware";

const createProductAndAddToRoundSchema = z.object({
	roundId: z.string().uuid(),
	name: z.string().min(1),
	brand: z.string().optional(),
	foreignPrice: z.number().min(0),
});

export const createProductAndAddToRound = createServerFn({ method: "POST" })
	.inputValidator(createProductAndAddToRoundSchema)
	.handler(async ({ data }) => {
		const session = await requireSession();

		const [round] = await db
			.select()
			.from(rounds)
			.where(eq(rounds.id, data.roundId))
			.limit(1);
		if (!round) throw new Error("Round not found");

		const fxRate = Number(round.fxRate);
		const perItemFee = Number(round.perItemFeeTh);
		const sellPriceThb = data.foreignPrice * fxRate + perItemFee;

		const [product] = await db
			.insert(products)
			.values({
				name: data.name,
				brand: data.brand ?? null,
			})
			.returning();

		await writeAudit({
			userId: session.user.id,
			entity: "product",
			entityId: product.id,
			action: "create",
			diff: { name: data.name, brand: data.brand, source: "inline_order" },
		});

		const [roundProduct] = await db
			.insert(roundProducts)
			.values({
				roundId: data.roundId,
				productId: product.id,
				foreignPrice: String(data.foreignPrice),
				sellPriceThb: String(sellPriceThb),
				priceOverridden: false,
			})
			.returning();

		await writeAudit({
			userId: session.user.id,
			entity: "round_product",
			entityId: roundProduct.id,
			action: "create_inline",
			diff: {
				roundId: data.roundId,
				productId: product.id,
				foreignPrice: data.foreignPrice,
				sellPriceThb,
			},
		});

		return {
			...roundProduct,
			productName: product.name,
			productBrand: product.brand,
			productCategory: product.category,
			productThumbKey: product.thumbKey,
			productThumbUrl: null as string | null,
		};
	});
