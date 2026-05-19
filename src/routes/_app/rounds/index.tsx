import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { Plus, ShoppingBag } from "lucide-react"
import { useTranslation } from "react-i18next"
import { EmptyState } from "#/components/empty-state"
import { RoundStatusBadge } from "#/components/round-status-badge"
import { Button } from "#/components/ui/button"
import { Card } from "#/components/ui/card"
import type { Round } from "#/db/schema"
import { listRounds } from "#/server/functions/rounds/list"
import type { RoundStatus } from "#/shared/schemas/round"

export const Route = createFileRoute("/_app/rounds/")({
	loader: async ({ context: { queryClient } }) => {
		await queryClient.ensureQueryData({
			queryKey: ["rounds"],
			queryFn: () => listRounds(),
		})
	},
	component: RoundsPage,
})

function RoundsPage() {
	const { t } = useTranslation("rounds")
	const { data: rounds } = useSuspenseQuery({
		queryKey: ["rounds"],
		queryFn: () => listRounds(),
	})

	return (
		<div className="max-w-5xl mx-auto px-4 py-6">
			<div className="flex items-center justify-between mb-6">
				<h1 className="text-2xl font-semibold text-foreground">
					{t("list.title")}
				</h1>
				<Button asChild variant="default">
					<Link to="/rounds/new">
						<Plus size={16} />
						{t("list.createFirst")}
					</Link>
				</Button>
			</div>

			{rounds.length === 0 ? (
				<EmptyState
					icon={<ShoppingBag size={32} className="text-ink-muted" />}
					title={t("list.empty")}
					hint={t("list.emptyHint")}
				/>
			) : (
				<ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
					{rounds.map((round) => (
						<RoundCard key={round.id} round={round} />
					))}
				</ul>
			)}
		</div>
	)
}

function RoundCard({ round }: { round: Round }) {
	return (
		<li>
			<Link to="/rounds/$roundId" params={{ roundId: round.id }} className="block">
				<Card className="flex items-start justify-between px-4 py-3 hover:bg-accent/50 transition-colors">
					<div className="min-w-0">
						<p className="font-medium text-foreground truncate">{round.name}</p>
						<p className="text-sm text-muted-foreground mt-0.5">
							{round.country}
							{round.storeHint ? ` · ${round.storeHint}` : ""}
							{" · "}
							{round.sourceCurrency}
						</p>
					</div>
					<RoundStatusBadge status={round.status as RoundStatus} />
				</Card>
			</Link>
		</li>
	)
}
