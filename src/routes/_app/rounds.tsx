import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, ShoppingBag } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Round } from "#/db/schema";
import { listRounds } from "#/server/functions/rounds/list";
import type { RoundStatus } from "#/shared/schemas/round";

export const Route = createFileRoute("/_app/rounds")({
	loader: async ({ context: { queryClient } }) => {
		await queryClient.ensureQueryData({
			queryKey: ["rounds"],
			queryFn: () => listRounds(),
		});
	},
	component: RoundsPage,
});

function RoundsPage() {
	const { t } = useTranslation("rounds");
	const { data: rounds } = useSuspenseQuery({
		queryKey: ["rounds"],
		queryFn: () => listRounds(),
	});

	return (
		<div className="max-w-2xl mx-auto px-4 py-6">
			<div className="flex items-center justify-between mb-6">
				<h1 className="text-2xl font-semibold text-foreground">
					{t("list.title")}
				</h1>
				<Link
					to="/rounds/new"
					className="flex items-center gap-2 rounded-md bg-hanko px-3 py-2 text-sm font-medium text-bone hover:bg-hanko-hover transition-colors"
				>
					<Plus size={16} />
					{t("list.createFirst")}
				</Link>
			</div>

			{rounds.length === 0 ? (
				<RoundsEmptyState />
			) : (
				<ul className="space-y-3">
					{rounds.map((round) => (
						<RoundCard key={round.id} round={round} />
					))}
				</ul>
			)}
		</div>
	);
}

function RoundCard({ round }: { round: Round }) {
	return (
		<li>
			<Link
				to="/rounds/$roundId"
				params={{ roundId: round.id }}
				className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 hover:bg-accent/50 transition-colors"
			>
				<div className="min-w-0">
					<p className="font-medium text-foreground truncate">{round.name}</p>
					<p className="text-sm text-muted-foreground mt-0.5">
						{round.country}
						{round.storeHint ? ` · ${round.storeHint}` : ""}
						{" · "}
						{round.sourceCurrency}
					</p>
				</div>
				<StatusBadge status={round.status as RoundStatus} />
			</Link>
		</li>
	);
}

function StatusBadge({ status }: { status: RoundStatus }) {
	const { t: tRounds } = useTranslation("rounds");

	const colorMap: Record<RoundStatus, string> = {
		draft: "bg-muted text-muted-foreground",
		open: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
		closed: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
		shipping: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
		done: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
		archived: "bg-muted text-muted-foreground opacity-60",
	};

	return (
		<span
			className={`shrink-0 ml-3 rounded-full px-2.5 py-0.5 text-xs font-medium ${colorMap[status]}`}
		>
			{tRounds(`status.${status}`)}
		</span>
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
