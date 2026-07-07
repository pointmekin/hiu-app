import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db/index";
import { orders, rounds } from "#/db/schema";
import { writeAudit } from "#/server/audit";
import { requireSession } from "#/server/middleware";

export const deleteRound = createServerFn({ method: "POST" })
	.inputValidator(z.object({ id: z.string().uuid() }))
	.handler(async ({ data }) => {
		const session = await requireSession();

		const result = await db.transaction(async (tx) => {
			// orders.round_id is ON DELETE RESTRICT, so orders (and their
			// cascaded order_items / order_payments) must go before the round.
			// round_products cascade from rounds automatically.
			// products are untouched — round_products only links them in.
			await tx.delete(orders).where(eq(orders.roundId, data.id));

			const [deleted] = await tx
				.delete(rounds)
				.where(eq(rounds.id, data.id))
				.returning({ id: rounds.id, name: rounds.name });

			return deleted;
		});

		if (!result) throw new Error("Round not found");

		await writeAudit({
			userId: session.user.id,
			entity: "round",
			entityId: data.id,
			action: "delete",
			diff: { name: result.name },
		});

		return result;
	});
