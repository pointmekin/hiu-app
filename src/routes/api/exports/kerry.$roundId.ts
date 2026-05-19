import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/exports/kerry/$roundId")({
	server: {
		handlers: {
			GET: async ({ request, params }) => {
				const [
					{ auth },
					{ buildKerryWorkbook },
					{ db },
					{ rounds },
					{ eq },
					{ useStorage },
				] = await Promise.all([
					import("#/lib/auth"),
					import("#/server/functions/exports/kerry"),
					import("#/db/index"),
					import("#/db/schema"),
					import("drizzle-orm"),
					import("nitro/storage"),
				]);
				const session = await auth.api.getSession({ headers: request.headers });
				if (!session) {
					return new Response("Unauthorized", { status: 401 });
				}

				const templateStorage = useStorage("assets:templates");

				try {
					const [round, templateRaw] = await Promise.all([
						db
							.select({ name: rounds.name, deliveryEta: rounds.deliveryEta })
							.from(rounds)
							.where(eq(rounds.id, params.roundId))
							.limit(1)
							.then((r) => r[0]),
						templateStorage.getItemRaw(
							"kerry - 21-05-2026.xlsx",
						) as Promise<Uint8Array | null>,
					]);
					const deliveryDate = round?.deliveryEta
						? round.deliveryEta.toISOString().slice(0, 10)
						: "";
					const filename =
						round && deliveryDate
							? `${round.name} - ${deliveryDate}.xlsx`
							: "kerry.xlsx";

					const buffer = await buildKerryWorkbook(params.roundId, templateRaw);
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
