import { createFileRoute, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";

export const Route = createFileRoute("/_app/rounds/$roundId/summary")({
	component: SummaryPage,
});

function SummaryPage() {
	const { t } = useTranslation(["exports", "common"]);
	const { roundId } = useParams({ from: "/_app/rounds/$roundId/summary" });

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>{t("exports:japan05.title")}</CardTitle>
					<CardDescription>{t("exports:japan05.description")}</CardDescription>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-muted-foreground mb-4">
						{t("exports:japan05.sheets.orders")} ·{" "}
						{t("exports:japan05.sheets.summary")} ·{" "}
						{t("exports:japan05.sheets.customers")}
					</p>
					<Button asChild variant="default">
						<a href={`/api/exports/japan05/${roundId}`} download>
							{t("exports:japan05.download")}
						</a>
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}
