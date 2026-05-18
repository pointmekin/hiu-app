import { useSuspenseQuery } from "@tanstack/react-query"
import {
	createFileRoute,
	Link,
	Outlet,
	useParams,
} from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { getRound } from "#/server/functions/rounds/get"
import { RoundStatusBadge } from "#/components/round-status-badge"
import type { RoundStatus } from "#/shared/schemas/round"

export const Route = createFileRoute("/_app/rounds/$roundId")({
	loader: async ({ context: { queryClient }, params }) => {
		await queryClient.ensureQueryData({
			queryKey: ["rounds", params.roundId],
			queryFn: () => getRound({ data: { id: params.roundId } }),
		})
	},
	component: RoundLayout,
})

function RoundLayout() {
	const { t } = useTranslation("rounds")
	const { roundId } = useParams({ from: "/_app/rounds/$roundId" })

	const { data: round } = useSuspenseQuery({
		queryKey: ["rounds", roundId],
		queryFn: () => getRound({ data: { id: roundId } }),
	})

	return (
		<div className="flex flex-col min-h-full">
			<div className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 md:top-[57px] z-30">
				<div className="max-w-4xl mx-auto px-4 pt-4 pb-0">
					<div className="flex items-start justify-between gap-3 mb-3">
						<div className="min-w-0">
							<h1 className="text-xl font-semibold text-foreground truncate">
								{round.name}
							</h1>
							<p className="text-sm text-muted-foreground mt-0.5">
								{round.country}
								{round.storeHint ? ` · ${round.storeHint}` : ""}
								{" · "}
								{round.sourceCurrency}
								{" @ "}
								{Number(round.fxRate).toFixed(4)}
							</p>
						</div>
						<RoundStatusBadge status={round.status as RoundStatus} />
					</div>

					<nav className="-mb-px flex gap-0 overflow-x-auto">
						<TabLink
							to="/rounds/$roundId"
							params={{ roundId }}
							label={t("tab.overview")}
						/>
						<TabLink
							to="/rounds/$roundId/products"
							params={{ roundId }}
							label={t("tab.products")}
						/>
						<TabLink
							to="/rounds/$roundId/orders"
							params={{ roundId }}
							label={t("tab.orders")}
						/>
						<TabLink
							to="/rounds/$roundId/summary"
							params={{ roundId }}
							label={t("tab.summary")}
						/>
						<TabLink
							to="/rounds/$roundId/shipping"
							params={{ roundId }}
							label={t("tab.shipping")}
						/>
					</nav>
				</div>
			</div>

			<div className="flex-1 max-w-4xl w-full mx-auto px-4 py-6">
				<Outlet />
			</div>
		</div>
	)
}

function TabLink({
	to,
	params,
	label,
	disabled,
}: {
	to: string
	params: Record<string, string>
	label: string
	disabled?: boolean
}) {
	if (disabled) {
		return (
			<span className="shrink-0 px-4 py-2.5 text-sm font-medium text-muted-foreground/50 cursor-not-allowed border-b-2 border-transparent">
				{label}
			</span>
		)
	}

	return (
		<Link
			to={to}
			params={params}
			className="shrink-0 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground border-b-2 border-transparent transition-colors"
			activeProps={{
				className:
					"shrink-0 px-4 py-2.5 text-sm font-medium text-foreground border-b-2 border-hanko",
			}}
			activeOptions={{ exact: to.endsWith("$roundId") }}
		>
			{label}
		</Link>
	)
}
