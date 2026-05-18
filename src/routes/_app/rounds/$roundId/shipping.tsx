import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { getKerryRows } from "#/server/functions/exports/get-kerry-rows";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "#/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "#/components/ui/table";

export const Route = createFileRoute("/_app/rounds/$roundId/shipping")({
	loader: async ({ context: { queryClient }, params }) => {
		await queryClient.ensureQueryData({
			queryKey: ["kerry", params.roundId],
			queryFn: () => getKerryRows({ data: { roundId: params.roundId } }),
		});
	},
	component: ShippingPage,
});

function ShippingPage() {
	const { t } = useTranslation(["exports", "common"]);
	const { roundId } = useParams({ from: "/_app/rounds/$roundId/shipping" });

	const { data: rows } = useSuspenseQuery({
		queryKey: ["kerry", roundId],
		queryFn: () => getKerryRows({ data: { roundId } }),
		refetchOnMount: "always",
	});

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>{t("exports:kerry.title")}</CardTitle>
					<CardDescription>
						{t("exports:kerry.description")}
						{" — "}
						{t("exports:kerry.filterHint")}
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<Button asChild variant="brand">
						<a href={`/api/exports/kerry/${roundId}`} download>
							{t("exports:kerry.download")}
						</a>
					</Button>

					{rows.length === 0 ? (
						<p className="text-sm text-muted-foreground py-4">
							{t("exports:kerry.empty")}
						</p>
					) : (
						<div className="overflow-x-auto">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead className="w-12">No</TableHead>
										<TableHead>{t("exports:kerry.col.recipient")}</TableHead>
										<TableHead>{t("exports:kerry.col.mobile")}</TableHead>
										<TableHead>{t("exports:kerry.col.address")}</TableHead>
										<TableHead>{t("exports:kerry.col.postalCode")}</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{rows.map((row) => (
										<TableRow key={row.no}>
											<TableCell className="font-mono">{row.no}</TableCell>
											<TableCell>{row.recipientName || t("exports:kerry.noAddress")}</TableCell>
											<TableCell className="font-mono">{row.mobile}</TableCell>
											<TableCell>{row.address}</TableCell>
											<TableCell className="font-mono">{row.postalCode}</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
