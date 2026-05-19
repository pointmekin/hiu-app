import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/exports/kerry/$roundId")({
	server: {
		handlers: {
			GET: async ({ request, params }) => {
				const [{ auth }, { buildKerryWorkbook }, { db }, { rounds }, { eq }] =
					await Promise.all([
						import("#/lib/auth"),
						import("#/server/functions/exports/kerry"),
						import("#/db/index"),
						import("#/db/schema"),
						import("drizzle-orm"),
					]);
				const session = await auth.api.getSession({ headers: request.headers });
				if (!session) {
					return new Response("Unauthorized", { status: 401 });
				}

				try {
					const [round] = await db
						.select({ name: rounds.name, deliveryEta: rounds.deliveryEta })
						.from(rounds)
						.where(eq(rounds.id, params.roundId))
						.limit(1);
					const deliveryDate = round?.deliveryEta
						? round.deliveryEta.toISOString().slice(0, 10)
						: "";
					const filename =
						round && deliveryDate
							? `${round.name} - ${deliveryDate}.xlsx`
							: "kerry.xlsx";

					const buffer = await buildKerryWorkbook(params.roundId);
					return new Response(buffer, {
						headers: {
							"Content-Type":
								"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
							"Content-Disposition": `attachment; filename="${filename}"`,
							"Cache-Control": "no-store",
						},
					});
				} catch (err) {
					const message = err instanceof Error ? err.message : "Export failed";
					return new Response(message, { status: 500 });
				}
			},
		},
	},
});
