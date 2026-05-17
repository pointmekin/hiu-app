import { createFileRoute } from "@tanstack/react-router";
import { Plus, ShoppingBag } from "lucide-react";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_app/rounds")({
	component: RoundsPage,
});

function RoundsPage() {
	const { t } = useTranslation("rounds");

	return (
		<div className="max-w-2xl mx-auto px-4 py-6">
			<div className="flex items-center justify-between mb-6">
				<h1 className="text-2xl font-semibold text-foreground">
					{t("list.title")}
				</h1>
				<button
					type="button"
					className="flex items-center gap-2 rounded-md bg-hanko px-3 py-2 text-sm font-medium text-bone hover:bg-hanko-hover transition-colors"
				>
					<Plus size={16} />
					{t("list.createFirst")}
				</button>
			</div>

			<RoundsEmptyState />
		</div>
	);
}

function RoundsEmptyState() {
	const { t } = useTranslation("rounds");

	return (
		<div className="flex flex-col items-center justify-center py-20 text-center">
			<div className="rounded-full bg-bone-soft p-5 mb-4">
				<ShoppingBag size={32} className="text-ink-muted" />
			</div>
			<p className="text-lg font-medium text-foreground mb-1">
				{t("list.empty")}
			</p>
			<p className="text-sm text-muted-foreground">{t("list.emptyHint")}</p>
		</div>
	);
}
