import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { db } from "#/db/index";
import { rounds } from "#/db/schema";
import { writeAudit } from "#/server/audit";
import { requireSession } from "#/server/middleware";
import { updateRoundSchema } from "#/shared/schemas/round";

export const updateRound = createServerFn({ method: "POST" })
	.inputValidator(updateRoundSchema)
	.handler(async ({ data }) => {
		const session = await requireSession();
		const { id, ...fields } = data;

		const patch: Record<string, unknown> = {};
		if (fields.name !== undefined) patch.name = fields.name;
		if (fields.country !== undefined) patch.country = fields.country;
		if (fields.storeHint !== undefined) patch.storeHint = fields.storeHint;
		if (fields.status !== undefined) patch.status = fields.status;
		if (fields.sourceCurrency !== undefined)
			patch.sourceCurrency = fields.sourceCurrency;
		if (fields.fxRate !== undefined) patch.fxRate = String(fields.fxRate);
		if (fields.perItemFeeTh !== undefined)
			patch.perItemFeeTh = String(fields.perItemFeeTh);
		if (fields.defaultShippingFee !== undefined)
			patch.defaultShippingFee = String(fields.defaultShippingFee);
		if (fields.notes !== undefined) patch.notes = fields.notes;
		if (fields.purchaseStart !== undefined)
			patch.purchaseStart = fields.purchaseStart
				? new Date(fields.purchaseStart)
				: null;
		if (fields.purchaseEnd !== undefined)
			patch.purchaseEnd = fields.purchaseEnd
				? new Date(fields.purchaseEnd)
				: null;
		if (fields.deliveryEta !== undefined)
			patch.deliveryEta = fields.deliveryEta
				? new Date(fields.deliveryEta)
				: null;

		const [round] = await db
			.update(rounds)
			.set(patch)
			.where(eq(rounds.id, id))
			.returning();

		if (!round) throw new Error("Round not found");

		await writeAudit({
			userId: session.user.id,
			entity: "round",
			entityId: id,
			action: "update",
			diff: patch,
		});

		return round;
	});
