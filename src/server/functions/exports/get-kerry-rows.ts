import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSession } from "#/server/middleware";
import { fetchKerryData } from "./kerry";

export const getKerryRows = createServerFn({ method: "GET" })
	.inputValidator(z.object({ roundId: z.string().uuid() }))
	.handler(async ({ data }) => {
		await requireSession();
		return fetchKerryData(data.roundId);
	});
