import {
	useMutation,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, ShoppingCart } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { PurchaseTrackerItem } from "#/server/functions/round-products/list-for-purchase-tracker";
import { listForPurchaseTracker } from "#/server/functions/round-products/list-for-purchase-tracker";
import { updateBoughtQty } from "#/server/functions/round-products/update-bought-qty";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "#/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";
import { cn } from "#/lib/utils";

export const Route = createFileRoute("/_app/rounds/$roundId/purchase")({
	loader: async ({ context: { queryClient }, params }) => {
		await queryClient.ensureQueryData({
			queryKey: ["purchase-tracker", params.roundId],
			queryFn: () =>
				listForPurchaseTracker({ data: { roundId: params.roundId } }),
		});
	},
	component: PurchasePage,
});

// ── Types ─────────────────────────────────────────────────────────────────────

type GroupBy = "store" | "category" | "none";

interface ItemGroup {
	key: string;
	label: string;
	items: PurchaseTrackerItem[];
	completedCount: number;
}

// ── Group computation ─────────────────────────────────────────────────────────

function computeGroups(
	items: PurchaseTrackerItem[],
	groupBy: GroupBy,
	noStoreLabel: string,
	noCategoryLabel: string,
): ItemGroup[] {
	if (groupBy === "none") {
		return [
			{
				key: "__all__",
				label: "",
				items,
				completedCount: items.filter(
					(i) => i.orderedQty > 0 && i.boughtQty >= i.orderedQty,
				).length,
			},
		];
	}

	const keyFn = (i: PurchaseTrackerItem) =>
		groupBy === "store"
			? (i.storeLocation ?? noStoreLabel)
			: (i.productCategory ?? noCategoryLabel);

	const map = new Map<string, PurchaseTrackerItem[]>();
	for (const item of items) {
		const key = keyFn(item);
		if (!map.has(key)) map.set(key, []);
		map.get(key)!.push(item);
	}

	return Array.from(map.entries()).map(([key, groupItems]) => ({
		key,
		label: key,
		items: groupItems,
		completedCount: groupItems.filter(
			(i) => i.orderedQty > 0 && i.boughtQty >= i.orderedQty,
		).length,
	}));
}

// ── Status chip ───────────────────────────────────────────────────────────────

type ItemStatus = "complete" | "partial" | "none" | "empty";

function getStatus(item: PurchaseTrackerItem): ItemStatus {
	if (item.orderedQty === 0) return "empty";
	if (item.boughtQty >= item.orderedQty) return "complete";
	if (item.boughtQty > 0) return "partial";
	return "none";
}

function StatusChip({ status, t }: { status: ItemStatus; t: ReturnType<typeof useTranslation>["t"] }) {
	if (status === "empty") {
		return <span className="text-xs text-muted-foreground">—</span>;
	}
	if (status === "complete") {
		return (
			<span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full whitespace-nowrap">
				{t("purchase.status.complete")}
			</span>
		);
	}
	if (status === "partial") {
		return (
			<span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full whitespace-nowrap">
				{t("purchase.status.partial")}
			</span>
		);
	}
	return (
		<span className="inline-flex items-center text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full whitespace-nowrap">
			{t("purchase.status.none")}
		</span>
	);
}

// ── Bought qty inline editor ──────────────────────────────────────────────────

function BoughtQtyCell({
	item,
	roundId,
	t,
}: {
	item: PurchaseTrackerItem;
	roundId: string;
	t: ReturnType<typeof useTranslation>["t"];
}) {
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);
	const [draft, setDraft] = useState(String(item.boughtQty));
	const inputRef = useRef<HTMLInputElement>(null);

	const mutation = useMutation({
		mutationFn: (qty: number) =>
			updateBoughtQty({ data: { roundProductId: item.id, boughtQty: qty } }),
		onMutate: async (qty) => {
			await queryClient.cancelQueries({
				queryKey: ["purchase-tracker", roundId],
			});
			const prev = queryClient.getQueryData<PurchaseTrackerItem[]>([
				"purchase-tracker",
				roundId,
			]);
			queryClient.setQueryData<PurchaseTrackerItem[]>(
				["purchase-tracker", roundId],
				(old) =>
					old?.map((i) =>
						i.id === item.id ? { ...i, boughtQty: qty } : i,
					) ?? [],
			);
			return { prev };
		},
		onError: (_err, _qty, ctx) => {
			if (ctx?.prev) {
				queryClient.setQueryData(["purchase-tracker", roundId], ctx.prev);
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: ["purchase-tracker", roundId] });
			setOpen(false);
		},
	});

	function save() {
		const qty = parseInt(draft, 10);
		if (!Number.isNaN(qty) && qty >= 0) {
			mutation.mutate(qty);
		}
	}

	return (
		<Popover
			open={open}
			onOpenChange={(v) => {
				setOpen(v);
				if (v) setDraft(String(item.boughtQty));
			}}
		>
			<PopoverTrigger asChild>
				<button
					type="button"
					className={cn(
						"font-mono tabular-nums rounded px-2 py-0.5 min-w-[2.5rem] text-right",
						"hover:bg-muted transition-colors cursor-pointer",
						"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
					)}
				>
					{item.boughtQty}
				</button>
			</PopoverTrigger>
			<PopoverContent className="w-44 p-3" align="end">
				<div className="space-y-2">
					<p className="text-xs font-medium text-muted-foreground">
						{t("purchase.editBoughtQty.label")}
					</p>
					<Input
						ref={inputRef}
						type="number"
						inputMode="numeric"
						min={0}
						value={draft}
						autoFocus
						onChange={(e) => setDraft(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") save();
							if (e.key === "Escape") setOpen(false);
						}}
						className="h-8 text-center font-mono"
					/>
					<div className="flex gap-1.5">
						<Button
							size="sm"
							className="flex-1 h-7 text-xs"
							disabled={mutation.isPending}
							onClick={save}
						>
							{t("purchase.editBoughtQty.save")}
						</Button>
						<Button
							size="sm"
							variant="ghost"
							className="h-7 text-xs"
							onClick={() => setOpen(false)}
						>
							{t("purchase.editBoughtQty.cancel")}
						</Button>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}

// ── Product row ───────────────────────────────────────────────────────────────

function PurchaseRow({
	item,
	roundId,
	t,
}: {
	item: PurchaseTrackerItem;
	roundId: string;
	t: ReturnType<typeof useTranslation>["t"];
}) {
	const remaining = Math.max(0, item.orderedQty - item.boughtQty);
	const status = getStatus(item);

	return (
		<tr
			className={cn(
				"border-t border-border transition-colors",
				status === "complete"
					? "bg-emerald-50/30 dark:bg-emerald-950/10"
					: "hover:bg-muted/20",
			)}
		>
			<td className="px-4 py-3">
				<div className="font-medium text-sm leading-tight">{item.productName}</div>
				{item.productBrand && (
					<div className="text-xs text-muted-foreground mt-0.5">
						{item.productBrand}
					</div>
				)}
			</td>
			<td className="px-4 py-3 text-right font-mono tabular-nums text-sm">
				{item.orderedQty}
			</td>
			<td className="px-4 py-3 text-right text-sm">
				<BoughtQtyCell item={item} roundId={roundId} t={t} />
			</td>
			<td className="px-4 py-3 text-right font-mono tabular-nums text-sm">
				<span
					className={cn(
						remaining > 0 ? "text-foreground" : "text-muted-foreground",
					)}
				>
					{remaining}
				</span>
			</td>
			<td className="px-4 py-3 text-center">
				<StatusChip status={status} t={t} />
			</td>
		</tr>
	);
}

// ── Store group card ──────────────────────────────────────────────────────────

function ItemGroupCard({
	group,
	roundId,
	showHeader,
	t,
}: {
	group: ItemGroup;
	roundId: string;
	showHeader: boolean;
	t: ReturnType<typeof useTranslation>["t"];
}) {
	const [open, setOpen] = useState(true);
	const pct =
		group.items.length === 0
			? 0
			: (group.completedCount / group.items.length) * 100;

	return (
		<div className="rounded-xl border border-border bg-card overflow-hidden">
			{showHeader && (
				<button
					type="button"
					onClick={() => setOpen((v) => !v)}
					className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
				>
					<span className="text-muted-foreground shrink-0">
						{open ? (
							<ChevronDown size={16} />
						) : (
							<ChevronRight size={16} />
						)}
					</span>

					<span className="font-semibold text-sm truncate flex-1">
						{group.label}
					</span>

					<span className="text-xs text-muted-foreground shrink-0">
						{t("purchase.progress", {
							completed: group.completedCount,
							total: group.items.length,
						})}
					</span>

					<div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden shrink-0">
						<div
							className="h-full bg-emerald-500 rounded-full transition-all duration-300"
							style={{ width: `${pct}%` }}
						/>
					</div>
				</button>
			)}

			{open && (
				<div className="overflow-x-auto">
					<table className="w-full">
						<thead>
							<tr className={cn(showHeader && "border-t border-border", "bg-muted/30")}>
								<th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">
									{t("purchase.col.product")}
								</th>
								<th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">
									{t("purchase.col.orderedQty")}
								</th>
								<th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">
									{t("purchase.col.boughtQty")}
								</th>
								<th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">
									{t("purchase.col.remaining")}
								</th>
								<th className="text-center px-4 py-2 text-xs font-medium text-muted-foreground">
									{t("purchase.col.status")}
								</th>
							</tr>
						</thead>
						<tbody>
							{group.items.map((item) => (
								<PurchaseRow
									key={item.id}
									item={item}
									roundId={roundId}
									t={t}
								/>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}

// ── Page ──────────────────────────────────────────────────────────────────────

function PurchasePage() {
	const { t } = useTranslation("rounds");
	const { roundId } = useParams({ from: "/_app/rounds/$roundId/purchase" });

	const { data: items } = useSuspenseQuery({
		queryKey: ["purchase-tracker", roundId],
		queryFn: () => listForPurchaseTracker({ data: { roundId } }),
		refetchOnMount: "always",
	});

	const [groupBy, setGroupBy] = useState<GroupBy>("store");
	const [filterStore, setFilterStore] = useState<string>("__all__");
	const [hideCompleted, setHideCompleted] = useState(false);

	const noStoreLabel = t("purchase.noStore");
	const noCategoryLabel = t("purchase.noCategory");

	const stores = useMemo(
		() =>
			Array.from(
				new Set(items.map((i) => i.storeLocation ?? noStoreLabel)),
			).sort(),
		[items, noStoreLabel],
	);

	const filtered = useMemo(() => {
		let result = items;
		if (filterStore !== "__all__") {
			result = result.filter(
				(i) => (i.storeLocation ?? noStoreLabel) === filterStore,
			);
		}
		if (hideCompleted) {
			result = result.filter(
				(i) => i.orderedQty === 0 || i.boughtQty < i.orderedQty,
			);
		}
		return result;
	}, [items, filterStore, hideCompleted, noStoreLabel]);

	const groups = useMemo(
		() => computeGroups(filtered, groupBy, noStoreLabel, noCategoryLabel),
		[filtered, groupBy, noStoreLabel, noCategoryLabel],
	);

	if (items.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-20 text-center gap-3">
				<ShoppingCart className="text-muted-foreground" size={40} strokeWidth={1.5} />
				<p className="text-muted-foreground text-sm">{t("purchase.empty")}</p>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{/* Controls */}
			<div className="flex flex-wrap items-center gap-3">
				<div className="flex items-center gap-2">
					<span className="text-sm text-muted-foreground shrink-0">
						{t("purchase.groupBy.label")}
					</span>
					<Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
						<SelectTrigger className="h-8 w-36 text-sm">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="store">{t("purchase.groupBy.store")}</SelectItem>
							<SelectItem value="category">
								{t("purchase.groupBy.category")}
							</SelectItem>
							<SelectItem value="none">{t("purchase.groupBy.none")}</SelectItem>
						</SelectContent>
					</Select>
				</div>

				{groupBy === "store" && stores.length > 1 && (
					<div className="flex items-center gap-2">
						<span className="text-sm text-muted-foreground shrink-0">
							{t("purchase.filterStore.label")}
						</span>
						<Select value={filterStore} onValueChange={setFilterStore}>
							<SelectTrigger className="h-8 w-44 text-sm">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="__all__">
									{t("purchase.filterStore.all")}
								</SelectItem>
								{stores.map((s) => (
									<SelectItem key={s} value={s}>
										{s}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				)}

				<label className="flex items-center gap-2 cursor-pointer ml-auto">
					<input
						type="checkbox"
						checked={hideCompleted}
						onChange={(e) => setHideCompleted(e.target.checked)}
						className="w-4 h-4 accent-hanko rounded"
					/>
					<span className="text-sm text-muted-foreground">
						{t("purchase.hideCompleted")}
					</span>
				</label>
			</div>

			{/* Groups */}
			{groups.length === 0 ? (
				<div className="text-center py-10 text-sm text-muted-foreground">
					{t("purchase.allDone")}
				</div>
			) : (
				<div className="space-y-3">
					{groups.map((group) => (
						<ItemGroupCard
							key={group.key}
							group={group}
							roundId={roundId}
							showHeader={groupBy !== "none"}
							t={t}
						/>
					))}
				</div>
			)}
		</div>
	);
}
