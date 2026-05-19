import { useSuspenseQuery } from "@tanstack/react-query"
import {
	createFileRoute,
	Link,
	Outlet,
	useLocation,
	useParams,
} from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { getRound } from "#/server/functions/rounds/get"
import { RoundStatusBadge } from "#/components/round-status-badge"
import { Tabs, TabsList, TabsTrigger } from "#/components/ui/tabs"
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

const TAB_PATHS = ["overview", "products", "orders", "summary", "shipping", "stats"] as const
type TabValue = (typeof TAB_PATHS)[number]

function getActiveTab(roundId: string, pathname: string): TabValue {
	if (pathname.endsWith(`/rounds/${roundId}`)) return "overview"
	for (const tab of TAB_PATHS) {
		if (tab !== "overview" && pathname.includes(`/rounds/${roundId}/${tab}`)) return tab
	}
	return "overview"
}

function RoundLayout() {
	const { t } = useTranslation("rounds")
	const { roundId } = useParams({ from: "/_app/rounds/$roundId" })
	const { pathname } = useLocation()

	const { data: round } = useSuspenseQuery({
		queryKey: ["rounds", roundId],
		queryFn: () => getRound({ data: { id: roundId } }),
	})

	const activeTab = getActiveTab(roundId, pathname)

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

					<Tabs value={activeTab}>
						<TabsList
							variant="line"
							className="h-auto w-full justify-start gap-0 rounded-none bg-transparent p-0 overflow-x-auto"
						>
							<NavTrigger value="overview" roundId={roundId} to="/rounds/$roundId">
								{t("tab.overview")}
							</NavTrigger>
							<NavTrigger value="products" roundId={roundId} to="/rounds/$roundId/products">
								{t("tab.products")}
							</NavTrigger>
							<NavTrigger value="orders" roundId={roundId} to="/rounds/$roundId/orders">
								{t("tab.orders")}
							</NavTrigger>
							<NavTrigger value="summary" roundId={roundId} to="/rounds/$roundId/summary">
								{t("tab.summary")}
							</NavTrigger>
							<NavTrigger value="shipping" roundId={roundId} to="/rounds/$roundId/shipping">
								{t("tab.shipping")}
							</NavTrigger>
							<NavTrigger value="stats" roundId={roundId} to="/rounds/$roundId/stats">
								{t("tab.stats")}
							</NavTrigger>
						</TabsList>
					</Tabs>
				</div>
			</div>

			<div className="flex-1 max-w-4xl w-full mx-auto px-4 py-6">
				<Outlet />
			</div>
		</div>
	)
}

function NavTrigger({
	value,
	roundId,
	to,
	children,
}: {
	value: TabValue
	roundId: string
	to: string
	children: React.ReactNode
}) {
	return (
		<TabsTrigger
			value={value}
			className="shrink-0 rounded-none border-0 px-4 py-2.5 after:bg-hanko data-[state=inactive]:font-normal"
			asChild
		>
			<Link to={to} params={{ roundId }}>
				{children}
			</Link>
		</TabsTrigger>
	)
}
