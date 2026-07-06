import {
	useMutation,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import {
	ChevronDown,
	ChevronRight,
	Maximize2,
	Minus,
	Plus,
	Search,
	ShoppingCart,
	X,
} from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { PurchaseTrackerSkeleton } from "#/components/round-skeletons";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "#/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";
import { cn } from "#/lib/utils";
import type { PurchaseTrackerItem } from "#/server/functions/round-products/list-for-purchase-tracker";
import { listForPurchaseTracker } from "#/server/functions/round-products/list-for-purchase-tracker";
import { updateBoughtQty } from "#/server/functions/round-products/update-bought-qty";

export const Route = createFileRoute("/_app/rounds/$roundId/purchase")({
	loader: async ({ context: { queryClient }, params }) => {
		const promise = queryClient.ensureQueryData({
			queryKey: ["purchase-tracker", params.roundId],
			queryFn: () =>
				listForPurchaseTracker({ data: { roundId: params.roundId } }),
		});
		if (typeof window === "undefined") {
			await promise;
		}
	},
	pendingComponent: PurchaseTrackerSkeleton,
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

function StatusChip({
	status,
	t,
}: {
	status: ItemStatus;
	t: ReturnType<typeof useTranslation>["t"];
}) {
	if (status === "empty") return null;
	if (status === "complete") {
		return (
			<span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full whitespace-nowrap shrink-0">
				{t("purchase.status.complete")}
			</span>
		);
	}
	if (status === "partial") {
		return (
			<span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full whitespace-nowrap shrink-0">
				{t("purchase.status.partial")}
			</span>
		);
	}
	return (
		<span className="inline-flex items-center text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full whitespace-nowrap shrink-0">
			{t("purchase.status.none")}
		</span>
	);
}

// ── Product row ───────────────────────────────────────────────────────────────

function ProductImageLightbox({
	src,
	alt,
	closeLabel,
	open,
	onOpenChange,
}: {
	src: string;
	alt: string;
	closeLabel: string;
	open: boolean;
	onOpenChange: (v: boolean) => void;
}) {
	return (
		<DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
			<DialogPrimitive.Portal>
				<DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
				<DialogPrimitive.Content
					aria-label={alt}
					onPointerDown={(e) => {
						if (e.target === e.currentTarget) onOpenChange(false);
					}}
					className="fixed inset-0 z-50 flex items-center justify-center p-6 outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
				>
					<img
						src={src}
						alt={alt}
						className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
					/>
					<DialogPrimitive.Close
						aria-label={closeLabel}
						className="absolute top-4 right-4 grid place-items-center w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
					>
						<X size={20} />
					</DialogPrimitive.Close>
				</DialogPrimitive.Content>
			</DialogPrimitive.Portal>
		</DialogPrimitive.Root>
	);
}

function PurchaseRow({
	item,
	roundId,
	t,
}: {
	item: PurchaseTrackerItem;
	roundId: string;
	t: ReturnType<typeof useTranslation>["t"];
}) {
	const queryClient = useQueryClient();
	const [popoverOpen, setPopoverOpen] = useState(false);
	const [lightboxOpen, setLightboxOpen] = useState(false);
	const [draft, setDraft] = useState(String(item.boughtQty));
	const inputRef = useRef<HTMLInputElement>(null);

	const status = getStatus(item);
	const remaining = Math.max(0, item.orderedQty - item.boughtQty);

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
					old?.map((i) => (i.id === item.id ? { ...i, boughtQty: qty } : i)) ??
					[],
			);
			return { prev };
		},
		onError: (_err, _qty, ctx) => {
			if (ctx?.prev) {
				queryClient.setQueryData(["purchase-tracker", roundId], ctx.prev);
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({
				queryKey: ["purchase-tracker", roundId],
			});
		},
	});

	function adjust(delta: number) {
		const next = Math.max(0, item.boughtQty + delta);
		mutation.mutate(next);
	}

	function saveFromPopover() {
		const qty = parseInt(draft, 10);
		if (!Number.isNaN(qty) && qty >= 0) {
			mutation.mutate(qty);
			setPopoverOpen(false);
		}
	}

	return (
		<div
			className={cn(
				"px-4 py-3 border-t border-border transition-colors",
				status === "complete"
					? "bg-emerald-50/30 dark:bg-emerald-950/10"
					: "hover:bg-muted/10",
			)}
		>
			<div className="flex gap-3">
				{/* Left: product thumbnail */}
				<div className="shrink-0">
					{item.productThumbUrl ? (
						<button
							type="button"
							onClick={() => setLightboxOpen(true)}
							aria-label={t("purchase.viewImage")}
							className="group relative block rounded-md overflow-hidden bg-muted ring-1 ring-border hover:ring-2 hover:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition"
						>
						<img
							src={item.productThumbUrl}
							alt=""
								loading="lazy"
								decoding="async"
								className="w-16 h-16 object-cover"
							/>
							<span className="absolute inset-0 grid place-items-center bg-black/0 group-hover:bg-black/40 transition-colors">
								<Maximize2
									size={16}
									className="text-white opacity-0 group-hover:opacity-100 transition-opacity"
								/>
							</span>
						</button>
					) : (
						<div className="w-16 h-16 rounded-md bg-muted ring-1 ring-border" />
					)}
				</div>

				{/* Right: name + stepper */}
				<div className="flex-1 min-w-0">
					{/* Product name + brand (full width, wraps) */}
					<div className="mb-1.5">
						<Link
							to="/products/$productId"
							params={{ productId: item.productId }}
							className="font-medium text-sm leading-snug hover:underline underline-offset-2 break-words"
						>
							{item.productName}
						</Link>
						{item.productBrand && (
							<div className="text-xs text-muted-foreground break-words">
								{item.productBrand}
							</div>
						)}
					</div>

					{/* Status chip (below name) */}
					{status !== "empty" && (
						<div className="mb-2.5">
							<StatusChip status={status} t={t} />
						</div>
					)}

					{/* Bottom: ordered / stepper / remaining */}
					<div className="flex items-center gap-3">
						{/* Ordered qty */}
						<div className="flex flex-col items-center min-w-[2.5rem]">
							<span className="text-[10px] text-muted-foreground leading-none mb-1">
								{t("purchase.col.orderedQty")}
							</span>
							<span className="font-mono tabular-nums text-sm font-medium">
								{item.orderedQty}
							</span>
						</div>

						{/* Bought qty stepper */}
						<div className="flex-1 flex flex-col items-center">
							<span className="text-[10px] text-muted-foreground leading-none mb-1">
								{t("purchase.col.boughtQty")}
							</span>
							<div className="flex items-center gap-1">
								<Button
									type="button"
									variant="outline"
									size="icon-xs"
									disabled={item.boughtQty <= 0 || mutation.isPending}
									onClick={() => adjust(-1)}
									className="h-7 w-7"
								>
									<Minus size={12} />
								</Button>

								<Popover
									open={popoverOpen}
									onOpenChange={(v) => {
										setPopoverOpen(v);
										if (v) setDraft(String(item.boughtQty));
									}}
								>
									<PopoverTrigger asChild>
										<button
											type="button"
											className={cn(
												"font-mono tabular-nums text-sm font-semibold",
												"w-9 text-center rounded py-0.5",
												"hover:bg-muted transition-colors cursor-pointer",
												"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
											)}
										>
											{item.boughtQty}
										</button>
									</PopoverTrigger>
									<PopoverContent className="w-40 p-3" align="center">
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
													if (e.key === "Enter") saveFromPopover();
													if (e.key === "Escape") setPopoverOpen(false);
												}}
												className="h-8 text-center font-mono"
											/>
											<div className="flex gap-1.5">
												<Button
													size="sm"
													className="flex-1 h-7 text-xs"
													disabled={mutation.isPending}
													onClick={saveFromPopover}
												>
													{t("purchase.editBoughtQty.save")}
												</Button>
												<Button
													size="sm"
													variant="ghost"
													className="h-7 text-xs"
													onClick={() => setPopoverOpen(false)}
												>
													{t("purchase.editBoughtQty.cancel")}
												</Button>
											</div>
										</div>
									</PopoverContent>
								</Popover>

								<Button
									type="button"
									variant="outline"
									size="icon-xs"
									disabled={mutation.isPending}
									onClick={() => adjust(1)}
									className="h-7 w-7"
								>
									<Plus size={12} />
								</Button>
							</div>
						</div>

						{/* Remaining */}
						<div className="flex flex-col items-center min-w-[2.5rem]">
							<span className="text-[10px] text-muted-foreground leading-none mb-1">
								{t("purchase.col.remaining")}
							</span>
							<span
								className={cn(
									"font-mono tabular-nums text-sm font-medium",
									remaining > 0 ? "text-foreground" : "text-muted-foreground",
								)}
							>
								{remaining}
							</span>
						</div>
					</div>
				</div>
			</div>

			{(item.productThumbUrl || item.productImageUrl) && (
				<ProductImageLightbox
					src={item.productImageUrl ?? item.productThumbUrl ?? ""}
					alt={item.productName}
					closeLabel={t("purchase.close")}
					open={lightboxOpen}
					onOpenChange={setLightboxOpen}
				/>
			)}
		</div>
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
						{open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
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
				<div>
					{group.items.map((item) => (
						<PurchaseRow key={item.id} item={item} roundId={roundId} t={t} />
					))}
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

	const [searchQuery, setSearchQuery] = useState("");
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
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase().trim();
			result = result.filter(
				(i) =>
					i.productName.toLowerCase().includes(q) ||
					i.productBrand?.toLowerCase().includes(q),
			);
		}
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
	}, [items, searchQuery, filterStore, hideCompleted, noStoreLabel]);

	const groups = useMemo(
		() => computeGroups(filtered, groupBy, noStoreLabel, noCategoryLabel),
		[filtered, groupBy, noStoreLabel, noCategoryLabel],
	);

	if (items.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-20 text-center gap-3">
				<ShoppingCart
					className="text-muted-foreground"
					size={40}
					strokeWidth={1.5}
				/>
				<p className="text-muted-foreground text-sm">{t("purchase.empty")}</p>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{/* Sticky search */}
			<div className="sticky top-0 z-10 -mx-4 px-4 pt-1 pb-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
				<div className="relative">
					<Search
						size={15}
						className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
					/>
					<Input
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder={t("purchase.search.placeholder")}
						className="pl-8 pr-8 h-9 text-sm"
					/>
					{searchQuery && (
						<button
							type="button"
							onClick={() => setSearchQuery("")}
							className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
						>
							<X size={14} />
						</button>
					)}
				</div>
			</div>

			{/* Controls */}
			<div className="flex flex-wrap items-center gap-3">
				<div className="flex items-center gap-2">
					<span className="text-sm text-muted-foreground shrink-0">
						{t("purchase.groupBy.label")}
					</span>
					<Select
						value={groupBy}
						onValueChange={(v) => setGroupBy(v as GroupBy)}
					>
						<SelectTrigger className="h-8 w-36 text-sm">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="store">
								{t("purchase.groupBy.store")}
							</SelectItem>
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
					{searchQuery.trim() ? t("purchase.noResults") : t("purchase.allDone")}
				</div>
			) : (
				<div
					className={cn(
						"gap-3",
						groupBy !== "none"
							? "grid grid-cols-1 md:grid-cols-2"
							: "space-y-3",
					)}
				>
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
