import { createServerFn } from "@tanstack/react-start";
import { desc } from "drizzle-orm";
import { db } from "#/db/index";
import { rounds } from "#/db/schema";
import { requireSession } from "#/server/middleware";

export const listRounds = createServerFn({ method: "GET" }).handler(
	async () => {
		await requireSession();
		return db.select().from(rounds).orderBy(desc(rounds.createdAt));
	},
);
