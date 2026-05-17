import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import { db } from "#/db/index";
import { roundProducts, rounds } from "#/db/schema";
import { writeAudit } from "#/server/audit";
import { requireSession } from "#/server/middleware";
import { recomputeFromFxSchema } from "#/shared/schemas/round-product";

export const recomputeFromFx = createServerFn({ method: "POST" })
	.inputValidator(recomputeFromFxSchema)
	.handler(async ({ data }) => {
		const session = await requireSession();

		const [round] = await db
			.select({ fxRate: rounds.fxRate, perItemFeeTh: rounds.perItemFeeTh })
			.from(rounds)
			.where(eq(rounds.id, data.roundId))
			.limit(1);

		if (!round) throw new Error("Round not found");

		const fxRate = Number(round.fxRate);
		const perItemFee = Number(round.perItemFeeTh);

		const nonOverridden = await db
			.select({ id: roundProducts.id, foreignPrice: roundProducts.foreignPrice })
			.from(roundProducts)
			.where(
				and(
					eq(roundProducts.roundId, data.roundId),
					eq(roundProducts.priceOverridden, false),
				),
			);

		let updated = 0;
		for (const row of nonOverridden) {
			const newPrice = Number(row.foreignPrice) * fxRate + perItemFee;
			await db
				.update(roundProducts)
				.set({ sellPriceThb: String(newPrice.toFixed(2)) })
				.where(eq(roundProducts.id, row.id));
			updated++;
		}

		await writeAudit({
			userId: session.user.id,
			entity: "round_products",
			entityId: data.roundId,
			action: "recompute_from_fx",
			diff: { updated, fxRate, perItemFee },
		});

		return { updated };
	});
