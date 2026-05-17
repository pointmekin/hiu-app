import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db/index";
import { rounds } from "#/db/schema";
import { requireSession } from "#/server/middleware";

export const getRound = createServerFn({ method: "GET" })
	.inputValidator(z.object({ id: z.string().uuid() }))
	.handler(async ({ data }) => {
		await requireSession();
		const [round] = await db
			.select()
			.from(rounds)
			.where(eq(rounds.id, data.id))
			.limit(1);
		if (!round) throw new Error("Round not found");
		return round;
	});
