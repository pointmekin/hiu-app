import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/exports/round-stats/$roundId")({
	server: {
		handlers: {
			GET: async ({ request, params }) => {
				const [{ auth }, { buildRoundStatsWorkbook }] = await Promise.all([
					import("#/lib/auth"),
					import("#/server/functions/exports/round-stats"),
				]);
				const session = await auth.api.getSession({ headers: request.headers });
				if (!session) {
					return new Response("Unauthorized", { status: 401 });
				}

				try {
					const { name, buffer } = await buildRoundStatsWorkbook(
						params.roundId,
					);
					const filename = encodeURIComponent(`${name.trim()} - stats.xlsx`);
					return new Response(buffer, {
						headers: {
							"Content-Type":
								"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
							"Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
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
