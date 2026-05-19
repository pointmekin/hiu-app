import { useSuspenseQuery } from "@tanstack/react-query";
import {
	Bar,
	BarChart,
	Cell,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { PAYMENT_FUNNEL_COLORS } from "#/lib/chart-theme";
import { getRoundStats } from "#/server/functions/dashboard/round-stats";

const THB = new Intl.NumberFormat("th-TH", {
	style: "currency",
	currency: "THB",
	maximumFractionDigits: 0,
});

export function RoundStatsDashboard({ roundId }: { roundId: string }) {
	const { t } = useTranslation("dashboard");
	const { data } = useSuspenseQuery({
		queryKey: ["dashboard", "round", roundId],
		queryFn: () => getRoundStats({ data: { roundId } }),
	});

	if (!data) return null;

	const funnelData = [
		{
			status: t("round.paymentFunnel.pending"),
			count: data.paymentFunnel.pending.count,
			amount: Number(data.paymentFunnel.pending.amount),
			fill: PAYMENT_FUNNEL_COLORS.pending,
		},
		{
			status: t("round.paymentFunnel.partial"),
			count: data.paymentFunnel.partial.count,
			amount: Number(data.paymentFunnel.partial.amount),
			fill: PAYMENT_FUNNEL_COLORS.partial,
		},
		{
			status: t("round.paymentFunnel.paid"),
			count: data.paymentFunnel.paid.count,
			amount: Number(data.paymentFunnel.paid.amount),
			fill: PAYMENT_FUNNEL_COLORS.paid,
		},
	];

	const kpis = [
		{ label: t("round.totalOrders"), value: String(data.totalOrders) },
		{ label: t("round.totalRevenue"), value: THB.format(Number(data.totalRevenue)) },
		{ label: t("round.totalCost"), value: THB.format(Number(data.totalCost)) },
		{ label: t("round.grossMargin"), value: THB.format(Number(data.grossMargin)) },
		{ label: t("round.outstandingBalance"), value: THB.format(Number(data.outstandingBalance)) },
		{ label: t("round.paidCount"), value: `${data.paidCount} / ${data.totalActiveOrders}` },
	];

	return (
		<div className="space-y-8">
			<div className="grid grid-cols-2 md:grid-cols-3 gap-4">
				{kpis.map((kpi) => (
					<Card key={kpi.label}>
						<CardContent className="pt-4 pb-4">
							<p className="text-xs text-muted-foreground mb-1">{kpi.label}</p>
							<p className="text-xl font-mono tabular-nums font-medium">
								{kpi.value}
							</p>
						</CardContent>
					</Card>
				))}
			</div>

			<Section title={t("round.paymentFunnel.title")}>
				<ResponsiveContainer width="100%" height={160}>
					<BarChart
						layout="vertical"
						data={funnelData}
						margin={{ top: 8, right: 8, bottom: 8, left: 80 }}
					>
						<XAxis type="number" />
						<YAxis dataKey="status" type="category" tick={{ fontSize: 12 }} />
						<Tooltip
							formatter={(value, name) => [
								name === "count" ? Number(value) : THB.format(Number(value)),
								name === "count"
									? t("round.paymentFunnel.count")
									: t("round.paymentFunnel.amount"),
							]}
						/>
						<Bar dataKey="count" radius={[0, 4, 4, 0]}>
							{funnelData.map((entry, i) => (
								<Cell key={String(i)} fill={entry.fill} />
							))}
						</Bar>
					</BarChart>
				</ResponsiveContainer>
			</Section>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
				<Section title={t("round.topProducts")}>
					{data.topProducts.length === 0 ? (
						<p className="text-sm text-muted-foreground py-4">—</p>
					) : (
						<ResponsiveContainer width="100%" height={300}>
							<BarChart
								layout="vertical"
								data={data.topProducts}
								margin={{ top: 0, right: 8, bottom: 0, left: 0 }}
							>
								<XAxis type="number" allowDecimals={false} />
								<YAxis
									dataKey="name"
									type="category"
									width={120}
									tick={{ fontSize: 11 }}
								/>
								<Bar dataKey="qty" radius={[0, 4, 4, 0]}>
									{data.topProducts.map((_, i) => (
										<Cell
											key={String(i)}
											fill={i === 0 ? "var(--hanko)" : "var(--ink-muted)"}
										/>
									))}
								</Bar>
							</BarChart>
						</ResponsiveContainer>
					)}
				</Section>

				<Section title={t("round.topCustomers")}>
					{data.topCustomers.length === 0 ? (
						<p className="text-sm text-muted-foreground py-4">—</p>
					) : (
						<ResponsiveContainer width="100%" height={300}>
							<BarChart
								layout="vertical"
								data={data.topCustomers.map((c) => ({
									...c,
									spend: Number(c.totalSpend),
								}))}
								margin={{ top: 0, right: 8, bottom: 0, left: 0 }}
							>
								<XAxis
									type="number"
									tickFormatter={(v: number) => THB.format(v)}
								/>
								<YAxis
									dataKey="name"
									type="category"
									width={100}
									tick={{ fontSize: 11 }}
								/>
								<Tooltip formatter={(v) => THB.format(Number(v))} />
								<Bar dataKey="spend" radius={[0, 4, 4, 0]}>
									{data.topCustomers.map((_, i) => (
										<Cell
											key={String(i)}
											fill={i === 0 ? "var(--hanko)" : "var(--ink-muted)"}
										/>
									))}
								</Bar>
							</BarChart>
						</ResponsiveContainer>
					)}
				</Section>
			</div>

			<Section title={t("round.dailyOrders")}>
				{data.dailyOrders.length === 0 ? (
					<p className="text-sm text-muted-foreground py-4">—</p>
				) : (
					<ResponsiveContainer width="100%" height={250}>
						<LineChart
							data={data.dailyOrders.map((d) => ({
								...d,
								revenueNum: Number(d.revenue),
							}))}
							margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
						>
							<XAxis dataKey="date" tick={{ fontSize: 11 }} />
							<YAxis
								yAxisId="count"
								orientation="left"
								allowDecimals={false}
								tick={{ fontSize: 11 }}
							/>
							<YAxis
								yAxisId="revenue"
								orientation="right"
								tickFormatter={(v: number) => THB.format(v)}
								tick={{ fontSize: 11 }}
							/>
							<Tooltip
								formatter={(value, name) => [
									name === "revenueNum"
										? THB.format(Number(value))
										: Number(value),
									name === "revenueNum"
										? t("round.revenue")
										: t("round.orderCount"),
								]}
							/>
							<Line
								yAxisId="count"
								type="monotone"
								dataKey="count"
								stroke="var(--ink-muted)"
								strokeWidth={2}
								dot={false}
							/>
							<Line
								yAxisId="revenue"
								type="monotone"
								dataKey="revenueNum"
								stroke="var(--hanko)"
								strokeWidth={2}
								strokeDasharray="4 4"
								dot={false}
							/>
						</LineChart>
					</ResponsiveContainer>
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
