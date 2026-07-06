import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db/index";
import { orders } from "#/db/schema";
import { writeAudit } from "#/server/audit";
import { requireSession } from "#/server/middleware";

export const deleteOrder = createServerFn({ method: "POST" })
	.inputValidator(z.object({ id: z.string().uuid() }))
	.handler(async ({ data }) => {
		const session = await requireSession();

		const [deleted] = await db
			.delete(orders)
			.where(eq(orders.id, data.id))
			.returning({ id: orders.id });

		if (!deleted) throw new Error("Order not found");

		await writeAudit({
			userId: session.user.id,
			entity: "order",
			entityId: data.id,
			action: "delete",
		});

		return deleted;
	});
