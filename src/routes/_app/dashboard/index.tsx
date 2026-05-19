import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
	Bar,
	BarChart,
	Cell,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { EmptyState } from "#/components/empty-state";
import { DashboardSkeleton } from "#/components/round-skeletons";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "#/components/ui/table";
import { getCrossRoundStats } from "#/server/functions/dashboard/cross-round-stats";

export const Route = createFileRoute("/_app/dashboard/")({
	loader: async ({ context: { queryClient } }) => {
		const promise = queryClient.ensureQueryData({
			queryKey: ["dashboard", "cross-round"],
			queryFn: () => getCrossRoundStats(),
		});
		if (typeof window === "undefined") {
			await promise;
		}
	},
	pendingComponent: DashboardSkeleton,
	component: CrossRoundDashboard,
});

const THB = new Intl.NumberFormat("th-TH", {
	style: "currency",
	currency: "THB",
	maximumFractionDigits: 0,
});

function CrossRoundDashboard() {
	const { t } = useTranslation("dashboard");
	const { data } = useSuspenseQuery({
		queryKey: ["dashboard", "cross-round"],
		queryFn: () => getCrossRoundStats(),
	});

	if (!data) return null;

	const recentRounds = data.recentRounds.map((r) => ({
		...r,
		revenueNum: Number(r.revenue),
		marginNum: Number(r.margin),
	}));

	return (
		<div className="space-y-8">
			<Section title={t("crossRound.recentRounds")}>
				{recentRounds.length === 0 ? (
					<EmptyState
						icon={<BarChart3 />}
						title={t("crossRound.recentRounds")}
						hint="—"
					/>
				) : (
					<ResponsiveContainer width="100%" height={300}>
						<BarChart
							data={recentRounds}
							margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
						>
							<XAxis dataKey="name" tick={{ fontSize: 12 }} />
							<YAxis
								tickFormatter={(v: number) => THB.format(v)}
								width={80}
								tick={{ fontSize: 11 }}
							/>
							<Tooltip
								formatter={(value, name) => [
									THB.format(Number(value)),
									name === "revenueNum"
										? t("crossRound.revenue")
										: t("crossRound.margin"),
								]}
							/>
							<Bar
								dataKey="revenueNum"
								name={t("crossRound.revenue")}
								fill="var(--hanko)"
								radius={[4, 4, 0, 0]}
							/>
							<Bar
								dataKey="marginNum"
								name={t("crossRound.margin")}
								fill="var(--ink-muted)"
								radius={[4, 4, 0, 0]}
							/>
						</BarChart>
					</ResponsiveContainer>
				)}
			</Section>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							{t("crossRound.repeatRate")}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-3xl font-mono tabular-nums">
							{data.repeatCustomerRate}%
						</p>
						<p className="text-xs text-muted-foreground mt-1">
							{t("crossRound.repeatRateHint")}
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							{t("crossRound.countryBreakdown")}
						</CardTitle>
					</CardHeader>
					<CardContent>
						{data.countryBreakdown.length === 0 ? (
							<p className="text-sm text-muted-foreground">—</p>
						) : (
							<ResponsiveContainer width="100%" height={120}>
								<BarChart
									layout="vertical"
									data={data.countryBreakdown}
									margin={{ top: 0, right: 8, bottom: 0, left: 40 }}
								>
									<XAxis type="number" allowDecimals={false} />
									<YAxis
										dataKey="country"
										type="category"
										tick={{ fontSize: 12 }}
									/>
									<Bar
										dataKey="roundCount"
										fill="var(--ink-muted)"
										radius={[0, 4, 4, 0]}
									>
										{data.countryBreakdown.map((_, i) => (
											<Cell
												key={String(i)}
												fill={i === 0 ? "var(--hanko)" : "var(--ink-muted)"}
											/>
										))}
									</Bar>
								</BarChart>
							</ResponsiveContainer>
						)}
					</CardContent>
				</Card>
			</div>

			<Section title={t("crossRound.topCustomers")}>
				{data.topAllTimeCustomers.length === 0 ? (
					<EmptyState
						icon={<Users />}
						title={t("crossRound.topCustomers")}
						hint="—"
					/>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>#</TableHead>
								<TableHead>{t("audit.user")}</TableHead>
								<TableHead className="text-right">
									{t("crossRound.revenue")}
								</TableHead>
								<TableHead className="text-right">
									{t("crossRound.orders")}
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{data.topAllTimeCustomers.map((c, i) => (
								<TableRow key={c.name}>
									<TableCell className="font-mono text-muted-foreground">
										{i + 1}
									</TableCell>
									<TableCell>{c.name}</TableCell>
									<TableCell className="text-right font-mono tabular-nums">
										{THB.format(Number(c.totalSpend))}
									</TableCell>
									<TableCell className="text-right font-mono tabular-nums">
										{c.orderCount}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</Section>
		</div>
	);
}

function Section({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="font-display text-lg">{title}</CardTitle>
			</CardHeader>
			<CardContent>{children}</CardContent>
		</Card>
	);
}
