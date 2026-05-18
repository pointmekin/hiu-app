import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/exports/japan05/$roundId")({
	server: {
		handlers: {
			GET: async ({ request, params }) => {
				const [{ auth }, { buildJapan05Workbook }] = await Promise.all([
					import("#/lib/auth"),
					import("#/server/functions/exports/japan05"),
				]);
				const session = await auth.api.getSession({ headers: request.headers });
				if (!session) {
					return new Response("Unauthorized", { status: 401 });
				}

				try {
					const buffer = await buildJapan05Workbook(params.roundId);
					return new Response(buffer, {
						headers: {
							"Content-Type":
								"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
							"Content-Disposition": `attachment; filename="japan05.xlsx"`,
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
