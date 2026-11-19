import { createServerFn } from "@tanstack/react-start";
import { and, eq, sql } from "drizzle-orm";
import { db } from "#/db/index";
import { roundProducts } from "#/db/schema";
import { writeAudit } from "#/server/audit";
import { requireSession } from "#/server/middleware";
import { recomputeFromFxSchema } from "#/shared/schemas/round-product";
import { lockRound, syncOrderPrices } from "../orders/pricing";

export const recomputeFromFx = createServerFn({ method: "POST" })
	.validator(recomputeFromFxSchema)
	.handler(async ({ data }) => {
		const session = await requireSession();

		const { updated, fxRate, perItemFee } = await db.transaction(async (tx) => {
			const round = await lockRound(tx, data.roundId);
			const repriced = await tx
				.update(roundProducts)
				.set({
					sellPriceThb: sql`${roundProducts.foreignPrice} * ${round.fxRate}::numeric + ${round.perItemFeeTh}::numeric`,
				})
				.where(
					and(
						eq(roundProducts.roundId, data.roundId),
						eq(roundProducts.priceOverridden, false),
					),
				)
				.returning({ id: roundProducts.id });

			await syncOrderPrices(
				tx,
				repriced.map(({ id }) => id),
			);
			return {
				updated: repriced.length,
				fxRate: Number(round.fxRate),
				perItemFee: Number(round.perItemFeeTh),
			};
		});

		await writeAudit({
			userId: session.user.id,
			entity: "round_products",
			entityId: data.roundId,
			action: "recompute_from_fx",
			diff: { updated, fxRate, perItemFee },
		});

		return { updated };
	});
