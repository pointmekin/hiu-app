import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { db } from "#/db/index";
import { roundProducts } from "#/db/schema";
import { writeAudit } from "#/server/audit";
import { requireSession } from "#/server/middleware";
import { updateBoughtQtySchema } from "#/shared/schemas/round-product";

export const updateBoughtQty = createServerFn({ method: "POST" })
	.inputValidator(updateBoughtQtySchema)
	.handler(async ({ data }) => {
		const session = await requireSession();

		const [updated] = await db
			.update(roundProducts)
			.set({ boughtQty: data.boughtQty })
			.where(eq(roundProducts.id, data.roundProductId))
			.returning({ id: roundProducts.id, roundId: roundProducts.roundId });

		if (!updated) {
			throw new Error("Round product not found");
		}

		await writeAudit({
			userId: session.user.id,
			entity: "round_products",
			entityId: data.roundProductId,
			action: "update_bought_qty",
			diff: { boughtQty: data.boughtQty },
		});

		return { id: updated.id };
	});
