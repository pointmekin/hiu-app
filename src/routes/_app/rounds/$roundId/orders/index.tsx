import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { OrdersListSkeleton } from "#/components/round-skeletons";
import { Plus, Search, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "#/components/empty-state";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { listOrders } from "#/server/functions/orders/list";
import type { PaymentStatus } from "#/shared/schemas/order";

export const Route = createFileRoute("/_app/rounds/$roundId/orders/")({
	loader: async ({ context: { queryClient }, params }) => {
		await queryClient.ensureQueryData({
			queryKey: ["orders", params.roundId, "all"],
			queryFn: () => listOrders({ data: { roundId: params.roundId } }),
		});
	},
	pendingComponent: OrdersListSkeleton,
	component: OrdersPage,
});

const FILTER_OPTIONS: Array<{ key: string; paymentStatus?: PaymentStatus }> = [
	{ key: "all" },
	{ key: "pending", paymentStatus: "pending" },
	{ key: "partial", paymentStatus: "partial" },
	{ key: "paid", paymentStatus: "paid" },
];

function OrdersPage() {
	const { t } = useTranslation("orders");
	const { roundId } = useParams({ from: "/_app/rounds/$roundId/orders/" });
	const [filter, setFilter] = useState<string>("all");
	const [textFilter, setTextFilter] = useState("");

	const selectedFilter = FILTER_OPTIONS.find((f) => f.key === filter);

	const { data: orders } = useSuspenseQuery({
		queryKey: ["orders", roundId, filter],
		queryFn: () =>
			listOrders({
				data: {
					roundId,
					paymentStatus: selectedFilter?.paymentStatus,
				},
			}),
	});

	const needle = textFilter.trim().toLowerCase();
	const visibleOrders = needle
		? orders.filter(
				(o) =>
					o.customerName.toLowerCase().includes(needle) ||
					o.items.some((item) => item.productName.toLowerCase().includes(needle)),
			)
		: orders;

	const activeOrders = visibleOrders.filter((o) => o.status === "active");
	const cancelledOrders = visibleOrders.filter((o) => o.status === "cancelled");

	return (
		<div>
			<div className="sticky top-[115px] md:top-[171px] z-10 bg-background pb-3 pt-1">
				<div className="flex items-center justify-between mb-3">
					<h2 className="text-lg font-semibold">{t("list.title")}</h2>
					<Button asChild variant="default" size="sm">
						<Link to="/rounds/$roundId/orders/new" params={{ roundId }}>
							<Plus size={16} />
							{t("list.createNew")}
						</Link>
					</Button>
				</div>

				<div className="relative mb-3">
					<Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
					<Input
						className="pl-8 h-8 text-sm"
						placeholder={t("list.searchPlaceholder")}
						value={textFilter}
						onChange={(e) => setTextFilter(e.target.value)}
					/>
				</div>

				{/* Filter tabs */}
				<div className="flex gap-1 overflow-x-auto pb-1">
					{FILTER_OPTIONS.map((opt) => (
						<button
							key={opt.key}
							type="button"
							onClick={() => setFilter(opt.key)}
							className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
								filter === opt.key
									? "bg-foreground text-background"
									: "bg-muted text-muted-foreground hover:text-foreground"
							}`}
						>
							{t(`list.filter.${opt.key}`)}
						</button>
					))}
				</div>
			</div>

			{activeOrders.length === 0 && cancelledOrders.length === 0 ? (
				<EmptyState
					icon={<ShoppingCart size={32} className="text-ink-muted" />}
					title={t("list.empty")}
					hint={t("list.emptyHint")}
				/>
			) : (
				<div className="space-y-4">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-2">
						{activeOrders.map((order) => (
							<OrderCard key={order.id} order={order} roundId={roundId} />
						))}
					</div>
					{cancelledOrders.length > 0 && (
						<div>
							<p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
								{t("status.cancelled")}
							</p>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-2">
								{cancelledOrders.map((order) => (
									<OrderCard
										key={order.id}
										order={order}
										roundId={roundId}
										dimmed
									/>
								))}
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	);
}

interface OrderItemPreview {
	productName: string;
	productBrand: string | null;
	quantity: number;
}

interface OrderCardOrder {
	id: string;
	customerId: string;
	customerName: string;
	totalThb: string;
	paidAmountThb: string;
	paymentStatus: string;
	status: string;
	createdAt: Date | null;
	items: OrderItemPreview[];
}

function OrderCard({
	order,
	roundId,
	dimmed = false,
}: {
	order: OrderCardOrder;
	roundId: string;
	dimmed?: boolean;
}) {
	const { t } = useTranslation("orders");
	const navigate = useNavigate();

	const total = Number(order.totalThb) || 0;
	const paid = Number(order.paidAmountThb) || 0;
	const balance = total - paid;

	const paymentStatusColors: Record<string, string> = {
		pending: "text-muted-foreground",
		partial: "text-amber-600 dark:text-amber-400",
		paid: "text-green-600 dark:text-green-400",
		refunded: "text-blue-600",
	};

	return (
		<Card
			className={`flex items-start justify-between px-4 py-3 hover:bg-accent/50 transition-colors cursor-pointer ${dimmed ? "opacity-50" : ""}`}
			onClick={() =>
				navigate({
					to: "/rounds/$roundId/orders/$orderId",
					params: { roundId, orderId: order.id },
				})
			}
		>
			<div className="min-w-0">
				<Link
					to="/customers/$customerId"
					params={{ customerId: order.customerId }}
					className="font-medium truncate underline-offset-2 hover:underline"
					onClick={(e) => e.stopPropagation()}
				>
					{order.customerName}
				</Link>
				<p
					className={`text-sm ${paymentStatusColors[order.paymentStatus] ?? "text-muted-foreground"}`}
				>
					{t(`paymentStatus.${order.paymentStatus}`)}
					{order.paymentStatus !== "paid" && balance > 0 && (
						<span className="ml-1 font-mono">
							· คงเหลือ{" "}
							{balance.toLocaleString("th-TH", {
								minimumFractionDigits: 0,
								maximumFractionDigits: 0,
							})}{" "}
							฿
						</span>
					)}
				</p>
				{order.items.length > 0 && (
					<p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
						{order.items.map((item) => `${item.productName} x${item.quantity}`).join(", ")}
					</p>
				)}
			</div>
			<p className="font-mono font-medium text-sm tabular-nums shrink-0">
				{total.toLocaleString("th-TH", {
					minimumFractionDigits: 0,
					maximumFractionDigits: 0,
				})}{" "}
				฿
			</p>
		</Card>
	);
}
