import { createServerFn } from "@tanstack/react-start";
import { db } from "#/db/index";
import { rounds } from "#/db/schema";
import { writeAudit } from "#/server/audit";
import { requireSession } from "#/server/middleware";
import { createRoundSchema } from "#/shared/schemas/round";

export const createRound = createServerFn({ method: "POST" })
	.inputValidator(createRoundSchema)
	.handler(async ({ data }) => {
		const session = await requireSession();

		const [round] = await db
			.insert(rounds)
			.values({
				name: data.name,
				country: data.country,
				storeHint: data.storeHint,
				purchaseStart: data.purchaseStart
					? new Date(data.purchaseStart)
					: undefined,
				purchaseEnd: data.purchaseEnd ? new Date(data.purchaseEnd) : undefined,
				deliveryEta: data.deliveryEta ? new Date(data.deliveryEta) : undefined,
				status: data.status,
				sourceCurrency: data.sourceCurrency,
				fxRate: String(data.fxRate),
				perItemFeeTh: String(data.perItemFeeTh),
				defaultShippingFee: String(data.defaultShippingFee),
				notes: data.notes,
				createdBy: session.user.id,
			})
			.returning();

		await writeAudit({
			userId: session.user.id,
			entity: "round",
			entityId: round.id,
			action: "create",
			diff: data,
		});

		return round;
	});
