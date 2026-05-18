import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db/index";
import { orders } from "#/db/schema";
import { writeAudit } from "#/server/audit";
import { requireSession } from "#/server/middleware";

export const cancelOrder = createServerFn({ method: "POST" })
	.inputValidator(z.object({ id: z.string().uuid() }))
	.handler(async ({ data }) => {
		const session = await requireSession();

		const [updated] = await db
			.update(orders)
			.set({ status: "cancelled", updatedAt: new Date() })
			.where(eq(orders.id, data.id))
			.returning({ id: orders.id, status: orders.status });

		if (!updated) throw new Error("Order not found");

		await writeAudit({
			userId: session.user.id,
			entity: "order",
			entityId: data.id,
			action: "cancel",
		});

		return updated;
	});
