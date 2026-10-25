import { useSuspenseQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	Cell,
	Legend,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import {
	BRAND_PALETTE,
	BREAKDOWN_COLORS,
	CHART_COLORS,
	COLLECTION_COLORS,
	PAYMENT_FUNNEL_COLORS,
} from "#/lib/chart-theme";
import { getRoundStats } from "#/server/functions/dashboard/round-stats";

const THB = new Intl.NumberFormat("th-TH", {
	style: "currency",
	currency: "THB",
	maximumFractionDigits: 0,
});

const FUNNEL_STATUSES = ["pending", "partial", "paid"] as const;

interface Segment {
	key: string;
	label: string;
	value: number;
	color: string;
}

function formatDay(date: string) {
	const [, month, day] = date.split("-");
	return `${day}/${month}`;
}

function percentOf(value: number, total: number) {
	if (total <= 0) return 0;
	return Math.round((value / total) * 100);
}

export function RoundStatsDashboard({ roundId }: { roundId: string }) {
	const { t } = useTranslation("dashboard");
	const { data } = useSuspenseQuery({
		queryKey: ["dashboard", "round", roundId],
		queryFn: () => getRoundStats({ data: { roundId } }),
	});

	if (!data) return null;

	const expected = Number(data.expectedRevenue);
	const collected = Number(data.collectedRevenue);
	const outstanding = Number(data.outstandingBalance);
	const productCost = Number(data.totalCost);
	const margin = Number(data.grossMargin);
	const shipping = Number(data.shippingFees);

	const collectionSegments: Segment[] = [
		{
			key: "collected",
			label: t("round.collection.collected"),
			value: Math.max(expected - outstanding, 0),
			color: COLLECTION_COLORS.collected,
		},
		{
			key: "outstanding",
			label: t("round.collection.outstanding"),
			value: outstanding,
			color: COLLECTION_COLORS.outstanding,
		},
	];

	const breakdownSegments: Segment[] = [
		{
			key: "cost",
			label: t("round.breakdown.cost"),
			value: productCost,
			color: BREAKDOWN_COLORS.cost,
		},
		{
			key: "margin",
			label: t("round.breakdown.margin"),
			value: margin,
			color: BREAKDOWN_COLORS.margin,
		},
		{
			key: "shipping",
			label: t("round.breakdown.shipping"),
			value: shipping,
			color: BREAKDOWN_COLORS.shipping,
		},
	];

	const funnelData = FUNNEL_STATUSES.map((status) => ({
		status: `${t(`round.paymentFunnel.${status}`)} · ${data.paymentFunnel[status].count}`,
		paid: Number(data.paymentFunnel[status].paid),
		remaining: Number(data.paymentFunnel[status].remaining),
		fill: PAYMENT_FUNNEL_COLORS[status],
	}));

	const methodData = data.paymentMethods.map((m) => ({
		name: m.method
			? t(`method.${m.method}`, { ns: "payments", defaultValue: m.method })
			: t("round.paymentMethods.unknown"),
		amount: Number(m.amount),
		count: m.count,
	}));

	const kpis = [
		{ label: t("round.totalOrders"), value: String(data.totalOrders) },
		{
			label: t("round.paidCount"),
			value: `${data.paidCount} / ${data.totalActiveOrders}`,
		},
		{ label: t("round.totalCost"), value: THB.format(productCost) },
		{
			label: t("round.grossMargin"),
			value: THB.format(margin),
			hint: t("round.grossMarginHint"),
		},
		{ label: t("round.shippingFees"), value: THB.format(shipping) },
	];

	return (
		<div className="space-y-8">
			<Section title={t("round.collection.title")}>
				<div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
					<Metric
						label={t("round.expectedRevenue")}
						value={THB.format(expected)}
						hint={t("round.expectedRevenueHint")}
					/>
					<Metric
						label={t("round.collectedRevenue")}
						value={THB.format(collected)}
						hint={t("round.collectedRevenueHint")}
						color={COLLECTION_COLORS.collected}
					/>
					<Metric
						label={t("round.outstandingBalance")}
						value={THB.format(outstanding)}
						hint={t("round.collectedPercent", {
							percent: percentOf(expected - outstanding, expected),
						})}
					/>
				</div>
				<StackedBar segments={collectionSegments} />
				<SegmentLegend segments={collectionSegments} />
			</Section>

			<div className="grid grid-cols-2 md:grid-cols-5 gap-4">
				{kpis.map((kpi) => (
					<Card key={kpi.label}>
						<CardContent className="pt-4 pb-4">
							<p className="text-xs text-muted-foreground mb-1">{kpi.label}</p>
							<p className="text-xl font-mono tabular-nums font-medium">
								{kpi.value}
							</p>
							{kpi.hint && (
								<p className="text-[11px] text-muted-foreground mt-1">
									{kpi.hint}
								</p>
							)}
						</CardContent>
					</Card>
				))}
			</div>

			<Section title={t("round.breakdown.title")}>
				<StackedBar segments={breakdownSegments} />
				<SegmentLegend segments={breakdownSegments} />
				{margin < 0 && (
					<p className="text-sm text-destructive mt-3">
						{t("round.breakdown.loss")}
					</p>
				)}
			</Section>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
				<Section title={t("round.paymentFunnel.title")}>
					<ResponsiveContainer width="100%" height={180}>
						<BarChart
							layout="vertical"
							data={funnelData}
							margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
						>
							<XAxis
								type="number"
								tickFormatter={(v: number) => THB.format(v)}
								tick={{ fontSize: 11 }}
							/>
							<YAxis
								dataKey="status"
								type="category"
								width={110}
								tick={{ fontSize: 12 }}
							/>
							<Tooltip formatter={(v) => THB.format(Number(v))} />
							<Legend wrapperStyle={{ fontSize: 12 }} />
							<Bar
								dataKey="paid"
								name={t("round.paymentFunnel.paidAmount")}
								stackId="funnel"
							>
								{funnelData.map((entry) => (
									<Cell key={entry.status} fill={entry.fill} />
								))}
							</Bar>
							<Bar
								dataKey="remaining"
								name={t("round.paymentFunnel.remaining")}
								stackId="funnel"
								fill={COLLECTION_COLORS.outstanding}
								fillOpacity={0.6}
								radius={[0, 4, 4, 0]}
							/>
						</BarChart>
					</ResponsiveContainer>
				</Section>

				<Section title={t("round.fulfillment.title")}>
					<div className="space-y-5 py-2">
						<ProgressRow
							label={t("round.fulfillment.packed")}
							value={data.packedCount}
							total={data.totalActiveOrders}
						/>
						<ProgressRow
							label={t("round.fulfillment.tracked")}
							value={data.trackedCount}
							total={data.totalActiveOrders}
						/>
					</div>
				</Section>
			</div>

			<Section title={t("round.cashFlow.title")}>
				<p className="text-xs text-muted-foreground -mt-2 mb-3">
					{t("round.cashFlow.hint")}
				</p>
				{data.cashFlow.length === 0 ? (
					<EmptyChart />
				) : (
					<ResponsiveContainer width="100%" height={260}>
						<AreaChart
							data={data.cashFlow}
							margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
						>
							<XAxis
								dataKey="date"
								tickFormatter={formatDay}
								tick={{ fontSize: 11 }}
							/>
							<YAxis
								tickFormatter={(v: number) => THB.format(v)}
								width={80}
								tick={{ fontSize: 11 }}
							/>
							<Tooltip
								labelFormatter={(d) => formatDay(String(d))}
								formatter={(v) => THB.format(Number(v))}
							/>
							<Legend wrapperStyle={{ fontSize: 12 }} />
							<Area
								type="stepAfter"
								dataKey="expected"
								name={t("round.cashFlow.expected")}
								stroke={BRAND_PALETTE.inkMuted}
								fill={BRAND_PALETTE.inkMuted}
								fillOpacity={0.1}
								strokeWidth={2}
							/>
							<Area
								type="stepAfter"
								dataKey="collected"
								name={t("round.cashFlow.collected")}
								stroke={COLLECTION_COLORS.collected}
								fill={COLLECTION_COLORS.collected}
								fillOpacity={0.25}
								strokeWidth={2}
							/>
						</AreaChart>
					</ResponsiveContainer>
				)}
			</Section>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
				<Section title={t("round.topCustomers")}>
					{data.topCustomers.length === 0 ? (
						<EmptyChart />
					) : (
						<ResponsiveContainer width="100%" height={320}>
							<BarChart
								layout="vertical"
								data={data.topCustomers.map((c) => ({
									name: c.name,
									paid: Number(c.paid),
									outstanding: Number(c.outstanding),
								}))}
								margin={{ top: 0, right: 8, bottom: 0, left: 0 }}
							>
								<XAxis
									type="number"
									tickFormatter={(v: number) => THB.format(v)}
									tick={{ fontSize: 11 }}
								/>
								<YAxis
									dataKey="name"
									type="category"
									width={100}
									tick={{ fontSize: 11 }}
								/>
								<Tooltip formatter={(v) => THB.format(Number(v))} />
								<Legend wrapperStyle={{ fontSize: 12 }} />
								<Bar
									dataKey="paid"
									name={t("round.collection.collected")}
									stackId="customer"
									fill={COLLECTION_COLORS.collected}
								/>
								<Bar
									dataKey="outstanding"
									name={t("round.collection.outstanding")}
									stackId="customer"
									fill={COLLECTION_COLORS.outstanding}
									radius={[0, 4, 4, 0]}
								/>
							</BarChart>
						</ResponsiveContainer>
					)}
				</Section>

				<Section title={t("round.topProducts")}>
					{data.topProducts.length === 0 ? (
						<EmptyChart />
					) : (
						<ResponsiveContainer width="100%" height={320}>
							<BarChart
								layout="vertical"
								data={data.topProducts.map((p) => ({
									name: p.name,
									qty: p.qty,
									revenue: Number(p.revenue),
								}))}
								margin={{ top: 0, right: 8, bottom: 0, left: 0 }}
							>
								<XAxis
									type="number"
									allowDecimals={false}
									tick={{ fontSize: 11 }}
								/>
								<YAxis
									dataKey="name"
									type="category"
									width={120}
									tick={{ fontSize: 11 }}
								/>
								<Tooltip
									formatter={(v, _name, item) => [
										`${Number(v)} · ${THB.format(item.payload.revenue)}`,
										`${t("round.qty")} · ${t("round.revenue")}`,
									]}
								/>
								<Bar dataKey="qty" radius={[0, 4, 4, 0]}>
									{data.topProducts.map((p, i) => (
										<Cell
											key={p.name}
											fill={
												i === 0 ? BRAND_PALETTE.hanko : BRAND_PALETTE.inkMuted
											}
										/>
									))}
								</Bar>
							</BarChart>
						</ResponsiveContainer>
					)}
				</Section>
			</div>

			<Section title={t("round.paymentMethods.title")}>
				{methodData.length === 0 ? (
					<EmptyChart />
				) : (
					<div className="flex flex-col sm:flex-row items-center gap-6">
						<ResponsiveContainer
							width="100%"
							height={200}
							className="sm:max-w-xs"
						>
							<PieChart>
								<Pie
									data={methodData}
									dataKey="amount"
									nameKey="name"
									innerRadius={55}
									outerRadius={85}
									paddingAngle={2}
								>
									{methodData.map((m, i) => (
										<Cell
											key={m.name}
											fill={CHART_COLORS[i % CHART_COLORS.length]}
										/>
									))}
								</Pie>
								<Tooltip formatter={(v) => THB.format(Number(v))} />
							</PieChart>
						</ResponsiveContainer>
						<ul className="space-y-2 text-sm w-full">
							{methodData.map((m, i) => (
								<li key={m.name} className="flex items-center gap-2">
									<span
										className="size-2.5 rounded-full shrink-0"
										style={{
											backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
										}}
									/>
									<span className="flex-1">{m.name}</span>
									<span className="text-muted-foreground text-xs">
										{t("round.paymentMethods.payments", { count: m.count })}
									</span>
									<span className="font-mono tabular-nums">
										{THB.format(m.amount)}
									</span>
								</li>
							))}
						</ul>
					</div>
				)}
			</Section>
		</div>
	);
}

function Metric({
	label,
	value,
	hint,
	color,
}: {
	label: string;
	value: string;
	hint: string;
	color?: string;
}) {
	return (
		<div>
			<p className="text-xs text-muted-foreground mb-1">{label}</p>
			<p
				className="text-2xl font-mono tabular-nums font-medium"
				style={{ color }}
			>
				{value}
			</p>
			<p className="text-[11px] text-muted-foreground mt-1">{hint}</p>
		</div>
	);
}

function StackedBar({ segments }: { segments: Segment[] }) {
	const visible = segments.filter((s) => s.value > 0);
	const total = visible.reduce((sum, s) => sum + s.value, 0);

	return (
		<div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
			{visible.map((s) => (
				<div
					key={s.key}
					title={`${s.label}: ${THB.format(s.value)}`}
					className="h-full transition-[width] duration-700 ease-out"
					style={{
						width: `${(s.value / total) * 100}%`,
						backgroundColor: s.color,
					}}
				/>
			))}
		</div>
	);
}

function SegmentLegend({ segments }: { segments: Segment[] }) {
	const total = segments.reduce((sum, s) => sum + Math.max(s.value, 0), 0);

	return (
		<ul className="flex flex-wrap gap-x-6 gap-y-2 mt-3 text-sm">
			{segments.map((s) => (
				<li key={s.key} className="flex items-center gap-2">
					<span
						className="size-2.5 rounded-full shrink-0"
						style={{ backgroundColor: s.color }}
					/>
					<span className="text-muted-foreground">{s.label}</span>
					<span className="font-mono tabular-nums">{THB.format(s.value)}</span>
					<span className="text-xs text-muted-foreground">
						{percentOf(Math.max(s.value, 0), total)}%
					</span>
				</li>
			))}
		</ul>
	);
}

function ProgressRow({
	label,
	value,
	total,
}: {
	label: string;
	value: number;
	total: number;
}) {
	const percent = percentOf(value, total);

	return (
		<div>
			<div className="flex justify-between text-sm mb-1.5">
				<span>{label}</span>
				<span className="font-mono tabular-nums text-muted-foreground">
					{value} / {total} · {percent}%
				</span>
			</div>
			<div className="h-2 w-full overflow-hidden rounded-full bg-muted">
				<div
					className="h-full rounded-full transition-[width] duration-700 ease-out"
					style={{ width: `${percent}%`, backgroundColor: BRAND_PALETTE.hanko }}
				/>
			</div>
		</div>
	);
}

function EmptyChart() {
	return <p className="text-sm text-muted-foreground py-4">—</p>;
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
