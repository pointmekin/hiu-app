import { useSuspenseQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	useNavigate,
	useParams,
} from "@tanstack/react-router";
import {
	Package,
	PackageCheck,
	Plus,
	Search,
	ShoppingCart,
	WalletCards,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "#/components/empty-state";
import { OrdersListSkeleton } from "#/components/round-skeletons";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { cn } from "#/lib/utils";
import { listOrders } from "#/server/functions/orders/list";
import type { PaymentStatus } from "#/shared/schemas/order";

export const Route = createFileRoute("/_app/rounds/$roundId/orders/")({
	loader: async ({ context: { queryClient }, params }) => {
		const promise = queryClient.ensureQueryData({
			queryKey: ["orders", params.roundId, "all", "all"],
			queryFn: () => listOrders({ data: { roundId: params.roundId } }),
		});
		if (typeof window === "undefined") {
			await promise;
		}
	},
	pendingComponent: OrdersListSkeleton,
	component: OrdersPage,
});

const PAYMENT_FILTER_OPTIONS: Array<{
	key: string;
	paymentStatus?: PaymentStatus;
}> = [
	{ key: "all" },
	{ key: "pending", paymentStatus: "pending" },
	{ key: "partial", paymentStatus: "partial" },
	{ key: "paid", paymentStatus: "paid" },
];

const PACKING_FILTER_OPTIONS: Array<{
	key: string;
	isPacked?: boolean;
	icon?: typeof Package;
}> = [
	{ key: "all" },
	{ key: "notPacked", isPacked: false, icon: Package },
	{ key: "packed", isPacked: true, icon: PackageCheck },
];

function OrdersPage() {
	const { t } = useTranslation("orders");
	const { roundId } = useParams({ from: "/_app/rounds/$roundId/orders/" });
	const [paymentFilter, setPaymentFilter] = useState("all");
	const [packingFilter, setPackingFilter] = useState("all");
	const [textFilter, setTextFilter] = useState("");

	const selectedPaymentFilter = PAYMENT_FILTER_OPTIONS.find(
		(option) => option.key === paymentFilter,
	);
	const selectedPackingFilter = PACKING_FILTER_OPTIONS.find(
		(option) => option.key === packingFilter,
	);

	const { data: orders } = useSuspenseQuery({
		queryKey: ["orders", roundId, paymentFilter, packingFilter],
		queryFn: () =>
			listOrders({
				data: {
					roundId,
					paymentStatus: selectedPaymentFilter?.paymentStatus,
					isPacked: selectedPackingFilter?.isPacked,
				},
			}),
	});

	const needle = textFilter.trim().toLowerCase();
	const visibleOrders = needle
		? orders.filter(
				(o) =>
					o.customerName.toLowerCase().includes(needle) ||
					o.items.some((item) =>
						item.productName.toLowerCase().includes(needle),
					),
			)
		: orders;

	const activeOrders = visibleOrders.filter((o) => o.status === "active");
	const cancelledOrders = visibleOrders.filter((o) => o.status === "cancelled");

	return (
		<div>
			<div className="sticky top-[108px] md:top-[164px] z-10 rounded-xl border bg-background/95 p-2.5 shadow-lg backdrop-blur-sm">
				<div className="flex items-center gap-2">
					<h2 className="hidden shrink-0 px-1 text-lg font-semibold sm:block">
						{t("list.title")}
					</h2>
					<div className="relative min-w-0 flex-1">
						<Search
							size={14}
							className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
						/>
						<Input
							className="h-8 pl-8 text-sm"
							placeholder={t("list.searchPlaceholder")}
							value={textFilter}
							onChange={(e) => setTextFilter(e.target.value)}
						/>
					</div>
					<Button asChild variant="default" size="sm" className="px-2 sm:px-3">
						<Link to="/rounds/$roundId/orders/new" params={{ roundId }}>
							<Plus size={16} />
							<span className="hidden sm:inline">{t("list.createNew")}</span>
							<span className="sr-only sm:hidden">{t("list.createNew")}</span>
						</Link>
					</Button>
				</div>

				<div className="mt-2 flex gap-2 overflow-x-auto pb-0.5">
					<FilterGroup
						label={t("list.filter.payment")}
						icon={<WalletCards size={13} />}
					>
						{PAYMENT_FILTER_OPTIONS.map((option) => (
							<FilterButton
								key={option.key}
								active={paymentFilter === option.key}
								onClick={() => setPaymentFilter(option.key)}
							>
								{t(`list.filter.${option.key}`)}
							</FilterButton>
						))}
					</FilterGroup>

					<FilterGroup
						label={t("list.filter.packing")}
						icon={<Package size={13} />}
						className="border-emerald-600/20 bg-emerald-50/50 dark:border-emerald-400/20 dark:bg-emerald-950/20"
					>
						{PACKING_FILTER_OPTIONS.map((option) => {
							const Icon = option.icon;
							return (
								<FilterButton
									key={option.key}
									active={packingFilter === option.key}
									onClick={() => setPackingFilter(option.key)}
									activeClassName="bg-emerald-700 text-white hover:text-white dark:bg-emerald-600"
								>
									{Icon && <Icon size={12} />}
									{t(`list.filter.${option.key}`)}
								</FilterButton>
							);
						})}
					</FilterGroup>
				</div>
			</div>

			<div className="py-2"></div>

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

function FilterGroup({
	label,
	icon,
	className,
	children,
}: {
	label: string;
	icon: ReactNode;
	className?: string;
	children: ReactNode;
}) {
	return (
		<div
			className={cn(
				"flex shrink-0 items-center gap-1 rounded-lg border bg-muted/30 p-1",
				className,
			)}
		>
			<span className="flex items-center gap-1 px-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
				{icon}
				{label}
			</span>
			<div className="h-4 w-px bg-border" aria-hidden="true" />
			{children}
		</div>
	);
}

function FilterButton({
	active,
	activeClassName,
	onClick,
	children,
}: {
	active: boolean;
	activeClassName?: string;
	onClick: () => void;
	children: ReactNode;
}) {
	return (
		<button
			type="button"
			aria-pressed={active}
			onClick={onClick}
			className={cn(
				"flex h-6 shrink-0 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors",
				!active && "hover:bg-background hover:text-foreground",
				active &&
					"bg-foreground text-background shadow-sm",
				active && activeClassName,
			)}
		>
			{children}
		</button>
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
						{order.items
							.map((item) => `${item.productName} x${item.quantity}`)
							.join(", ")}
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
