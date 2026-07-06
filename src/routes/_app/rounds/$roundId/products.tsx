import {
	useMutation,
	useQuery,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	useLocation,
	useParams,
} from "@tanstack/react-router";
import {
	AlertCircle,
	Check,
	Loader2,
	Package,
	Plus,
	RefreshCw,
	Save,
	Search,
	X,
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CatalogPickerDialog } from "#/components/catalog-picker-dialog";
import { EmptyState } from "#/components/empty-state";
import {
	type InlineCreatedProduct,
	InlineProductDialog,
} from "#/components/inline-product-dialog";
import { RoundProductsSkeleton } from "#/components/round-skeletons";
import { Alert, AlertDescription } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import { Checkbox } from "#/components/ui/checkbox";
import { Input } from "#/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "#/components/ui/table";
import { cn } from "#/lib/utils";
import type { ProductListItem } from "#/server/functions/products/list";
import { listRoundProducts } from "#/server/functions/round-products/list";
import { recomputeFromFx } from "#/server/functions/round-products/recompute-from-fx";
import { upsertRoundProducts } from "#/server/functions/round-products/upsert-many";
import { getRound } from "#/server/functions/rounds/get";

export const Route = createFileRoute("/_app/rounds/$roundId/products")({
	loader: async ({ context: { queryClient }, params }) => {
		const promise = queryClient.ensureQueryData({
			queryKey: ["rounds", params.roundId],
			queryFn: () => getRound({ data: { id: params.roundId } }),
		});
		if (typeof window === "undefined") {
			await promise;
		}
	},
	pendingComponent: RoundProductsSkeleton,
	component: RoundProductsPage,
});

interface DraftRow {
	productId: string;
	productName: string;
	productBrand: string | null;
	productThumbUrl: string | null;
	foreignPrice: string;
	sellPriceThb: string;
	priceOverridden: boolean;
	storeLocation: string;
}

type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

function computeSellPrice(
	foreignPrice: number,
	fxRate: number,
	perItemFee: number,
): string {
	return (foreignPrice * fxRate + perItemFee).toFixed(2);
}

function RoundProductsPage() {
	const { t } = useTranslation(["rounds", "common"]);
	const { roundId } = useParams({ from: "/_app/rounds/$roundId/products" });
	const queryClient = useQueryClient();
	const location = useLocation();
	const fromPath = location.pathname;

	const { data: round } = useSuspenseQuery({
		queryKey: ["rounds", roundId],
		queryFn: () => getRound({ data: { id: roundId } }),
	});

	const { data: roundProductRows, isPending: isLoadingProducts } = useQuery({
		queryKey: ["round-products", roundId],
		queryFn: () => listRoundProducts({ data: { roundId } }),
	});

	const fxRate = Number(round.fxRate);
	const perItemFee = Number(round.perItemFeeTh);

	const [rows, setRows] = useState<DraftRow[]>([]);
	const rowsRef = useRef<DraftRow[]>(rows);
	rowsRef.current = rows;

	useEffect(() => {
		if (!roundProductRows) return;
		setRows(
			roundProductRows.map((rp) => ({
				productId: rp.productId,
				productName: rp.productName,
				productBrand: rp.productBrand,
				productThumbUrl: rp.productThumbUrl,
				foreignPrice: rp.foreignPrice,
				sellPriceThb: rp.sellPriceThb,
				priceOverridden: rp.priceOverridden,
				storeLocation: rp.storeLocation ?? "",
			})),
		);
	}, [roundProductRows]);

	const [showCatalog, setShowCatalog] = useState(false);
	const [showInlineCreate, setShowInlineCreate] = useState(false);
	const [inlineCreateQuery, setInlineCreateQuery] = useState("");
	const [isDirty, setIsDirty] = useState(false);
	const [textFilter, setTextFilter] = useState("");
	const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

	const savedSnapshotRef = useRef<DraftRow[] | null>(null);
	const savedStatusTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
	const autosaveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

	const markDirty = useCallback(() => {
		setIsDirty(true);
		setSaveStatus("pending");
	}, []);

	const storeListId = `store-locs-${roundId}`;
	const storeLocationSuggestions = useMemo(
		() => [...new Set(rows.map((r) => r.storeLocation).filter(Boolean))],
		[rows],
	);

	const needle = textFilter.trim().toLowerCase();
	const visibleRows = useMemo(
		() =>
			needle
				? rows.filter(
						(r) =>
							r.productName.toLowerCase().includes(needle) ||
							(r.productBrand && r.productBrand.toLowerCase().includes(needle)),
					)
				: rows,
		[rows, needle],
	);

	const updateRow = useCallback(
		(productId: string, patch: Partial<DraftRow>) => {
			setRows((prev) =>
				prev.map((row) => {
					if (row.productId !== productId) return row;
					const updated = { ...row, ...patch };
					if ("foreignPrice" in patch && !updated.priceOverridden) {
						const fp = Number(patch.foreignPrice);
						if (!Number.isNaN(fp) && fp > 0) {
							updated.sellPriceThb = computeSellPrice(fp, fxRate, perItemFee);
						}
					}
					return updated;
				}),
			);
			markDirty();
		},
		[fxRate, perItemFee, markDirty],
	);

	const removeRow = useCallback(
		(productId: string) => {
			setRows((prev) => prev.filter((r) => r.productId !== productId));
			markDirty();
		},
		[markDirty],
	);

	function addFromCatalog(product: ProductListItem) {
		const alreadyAdded = rows.some((r) => r.productId === product.id);
		if (alreadyAdded) return;
		const hasDefaultPrice = product.defaultPriceThb != null;
		setRows((prev) => [
			...prev,
			{
				productId: product.id,
				productName: product.name,
				productBrand: product.brand,
				productThumbUrl: null,
				foreignPrice: "0",
				sellPriceThb: hasDefaultPrice ? String(product.defaultPriceThb) : "0",
				priceOverridden: hasDefaultPrice,
				storeLocation: "",
			},
		]);
		markDirty();
	}

	function openInlineCreate(query: string) {
		setInlineCreateQuery(query);
		setShowCatalog(false);
		setShowInlineCreate(true);
	}

	// The inline dialog already persists the product and invalidates the
	// round-products query, so the refetch will reconcile exact values. This
	// optimistic append is just for instant feedback — no setIsDirty needed.
	function handleInlineCreated(rp: InlineCreatedProduct) {
		setRows((prev) => {
			if (prev.some((r) => r.productId === rp.productId)) return prev;
			return [
				...prev,
				{
					productId: rp.productId,
					productName: rp.productName,
					productBrand: rp.productBrand,
					productThumbUrl: null,
					foreignPrice: "0",
					sellPriceThb: rp.sellPriceThb,
					priceOverridden: true,
					storeLocation: "",
				},
			];
		});
	}

	const saveMutation = useMutation({
		mutationFn: () => {
			const currentRows = rowsRef.current;
			savedSnapshotRef.current = currentRows;
			return upsertRoundProducts({
				data: {
					roundId,
					rows: currentRows.map((r) => ({
						productId: r.productId,
						foreignPrice: Number(r.foreignPrice) || 0,
						sellPriceThb: Number(r.sellPriceThb) || 0,
						priceOverridden: r.priceOverridden,
						storeLocation: r.storeLocation || undefined,
					})),
				},
			});
		},
		onMutate: () => setSaveStatus("saving"),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["round-products", roundId],
			});
			if (savedSnapshotRef.current !== rowsRef.current) {
				// Rows changed during save — stay pending so autosave re-fires.
				setSaveStatus("pending");
			} else {
				setIsDirty(false);
				setSaveStatus("saved");
				clearTimeout(savedStatusTimerRef.current);
				savedStatusTimerRef.current = setTimeout(
					() => setSaveStatus("idle"),
					2500,
				);
			}
			savedSnapshotRef.current = null;
		},
		onError: () => setSaveStatus("error"),
	});

	const mutateSaveRef = useRef(saveMutation.mutate);
	mutateSaveRef.current = saveMutation.mutate;

	// Auto-save 2s after the last edit, but never while a save is in flight.
	useEffect(() => {
		if (!isDirty || saveMutation.isPending) return;
		autosaveTimerRef.current = setTimeout(() => {
			mutateSaveRef.current();
		}, 2000);
		return () => clearTimeout(autosaveTimerRef.current);
	}, [isDirty, saveMutation.isPending]);

	useEffect(
		() => () => {
			clearTimeout(autosaveTimerRef.current);
			clearTimeout(savedStatusTimerRef.current);
		},
		[],
	);

	const recomputeMutation = useMutation({
		mutationFn: () => recomputeFromFx({ data: { roundId } }),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["round-products", roundId],
			});
		},
	});

	if (isLoadingProducts) {
		return <RoundProductsSkeleton />;
	}

	if (rows.length === 0) {
		return (
			<>
				<EmptyState
					icon={<Package size={32} className="text-ink-muted" />}
					title={t("rounds:products.empty")}
					hint={t("rounds:products.emptyHint")}
					action={
						<Button variant="default" onClick={() => setShowCatalog(true)}>
							<Plus size={16} />
							{t("rounds:products.addProduct")}
						</Button>
					}
				/>
				<CatalogPickerDialog
					open={showCatalog}
					onOpenChange={setShowCatalog}
					excludeIds={rows.map((r) => r.productId)}
					onSelect={addFromCatalog}
					onCreateNew={openInlineCreate}
				/>
				<InlineProductDialog
					open={showInlineCreate}
					onOpenChange={setShowInlineCreate}
					roundId={roundId}
					sourceCurrency={round.sourceCurrency}
					fxRate={fxRate}
					perItemFeeThb={perItemFee}
					initialName={inlineCreateQuery}
					onCreated={handleInlineCreated}
				/>
			</>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sticky top-[107px] md:top-[163px] z-20 bg-background py-2 -mx-4 px-4 border-b border-border/60">
				<div className="flex flex-col md:flex-row justify-between gap-2 w-full">
					<div className="flex gap-2">
						<div className="flex items-center gap-2 flex-wrap">
							{/* <div className="text-sm text-muted-foreground">
							{round.sourceCurrency} @ {fxRate.toFixed(4)}
							{perItemFee > 0 && ` + ฿${perItemFee}`}
						</div> */}
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => recomputeMutation.mutate()}
								disabled={recomputeMutation.isPending}
								title={t("rounds:products.recomputeHint")}
							>
								<RefreshCw size={14} />
								{t("rounds:products.recompute")}
							</Button>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => setShowCatalog(true)}
							>
								<Plus size={14} />
								{t("rounds:products.addProduct")}
							</Button>
							<Button
								type="button"
								variant="default"
								size="sm"
								onClick={() => saveMutation.mutate()}
								disabled={!isDirty || saveMutation.isPending}
							>
								<Save size={14} />
								{t("rounds:products.saveAll")}
							</Button>
							<AutoSaveStatus
								status={saveStatus}
								onRetry={() => saveMutation.mutate()}
								savingLabel={t("rounds:products.autosave.saving")}
								savedLabel={t("rounds:products.autosave.saved")}
								errorLabel={t("rounds:products.autosave.error")}
							/>
						</div>
					</div>

					{/* Search */}
					<div className="relative">
						<Search
							size={14}
							className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
						/>
						<Input
							className="pl-8 h-8 text-sm"
							placeholder={t("rounds:products.searchPlaceholder")}
							value={textFilter}
							onChange={(e) => setTextFilter(e.target.value)}
						/>
					</div>
				</div>
			</div>

			{saveMutation.error && (
				<Alert variant="destructive">
					<AlertDescription>
						{(saveMutation.error as Error).message}
					</AlertDescription>
				</Alert>
			)}

			{/* Mobile cards */}
			<div className="md:hidden space-y-3">
				{visibleRows.map((row) => {
					const fp = Number(row.foreignPrice);
					const computed = computeSellPrice(
						Number.isNaN(fp) ? 0 : fp,
						fxRate,
						perItemFee,
					);
					return (
						<MobileProductCard
							key={row.productId}
							row={row}
							computed={computed}
							currency={round.sourceCurrency}
							listId={storeListId}
							fromPath={fromPath}
							onUpdate={updateRow}
							onRemove={removeRow}
						/>
					);
				})}
			</div>

			{/* Desktop table */}
			<div className="hidden md:block overflow-x-auto rounded-lg border border-border">
				<Table>
					<TableHeader>
						<TableRow className="bg-muted/40">
							<TableHead>{t("rounds:products.column.product")}</TableHead>
							<TableHead className="text-right w-28">
								{t("rounds:products.column.foreignPrice")}
							</TableHead>
							<TableHead className="text-right w-28">
								{t("rounds:products.column.computedThb")}
							</TableHead>
							<TableHead className="text-right w-28">
								{t("rounds:products.column.sellPrice")}
							</TableHead>
							<TableHead className="text-center w-20">
								{t("rounds:products.column.override")}
							</TableHead>
							<TableHead className="w-36">
								{t("rounds:products.column.store")}
							</TableHead>
							<TableHead className="w-8" />
						</TableRow>
					</TableHeader>
					<TableBody>
						{visibleRows.map((row) => {
							const fp = Number(row.foreignPrice);
							const computed = computeSellPrice(
								Number.isNaN(fp) ? 0 : fp,
								fxRate,
								perItemFee,
							);
							return (
								<ProductRow
									key={row.productId}
									row={row}
									computed={computed}
									currency={round.sourceCurrency}
									listId={storeListId}
									fromPath={fromPath}
									onUpdate={updateRow}
									onRemove={removeRow}
								/>
							);
						})}
					</TableBody>
				</Table>
			</div>

			<datalist id={storeListId}>
				{storeLocationSuggestions.map((loc) => (
					<option key={loc} value={loc} />
				))}
			</datalist>

			<CatalogPickerDialog
				open={showCatalog}
				onOpenChange={setShowCatalog}
				excludeIds={rows.map((r) => r.productId)}
				onSelect={addFromCatalog}
				onCreateNew={openInlineCreate}
			/>

			<InlineProductDialog
				open={showInlineCreate}
				onOpenChange={setShowInlineCreate}
				roundId={roundId}
				sourceCurrency={round.sourceCurrency}
				fxRate={fxRate}
				perItemFeeThb={perItemFee}
				initialName={inlineCreateQuery}
				onCreated={handleInlineCreated}
			/>
		</div>
	);
}

const MobileProductCard = memo(function MobileProductCard({
	row,
	computed,
	currency,
	listId,
	fromPath,
	onUpdate,
	onRemove,
}: {
	row: DraftRow;
	computed: string;
	currency: string;
	listId: string;
	fromPath: string;
	onUpdate: (productId: string, patch: Partial<DraftRow>) => void;
	onRemove: (productId: string) => void;
}) {
	const { t } = useTranslation(["rounds"]);
	const handleUpdate = useCallback(
		(patch: Partial<DraftRow>) => onUpdate(row.productId, patch),
		[row.productId, onUpdate],
	);
	const handleRemove = useCallback(
		() => onRemove(row.productId),
		[row.productId, onRemove],
	);
	return (
		<div className="border border-border rounded-lg p-3 space-y-3 bg-card">
			<div className="flex items-start justify-between gap-2">
				<div className="flex items-center gap-2 min-w-0">
					{row.productThumbUrl ? (
						<img
							src={row.productThumbUrl}
							alt=""
							loading="lazy"
							decoding="async"
							className="w-16 h-16 rounded object-cover shrink-0 bg-muted"
						/>
					) : (
						<div className="w-16 h-16 rounded bg-muted shrink-0" />
					)}
					<div className="min-w-0">
						<Link
							to="/products/$productId"
							params={{ productId: row.productId }}
							search={{ from: fromPath }}
							className="font-medium text-foreground leading-tight underline-offset-2 hover:underline"
						>
							{row.productName}
						</Link>
						{row.productBrand && (
							<p className="text-xs text-muted-foreground">
								{row.productBrand}
							</p>
						)}
					</div>
				</div>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					onClick={handleRemove}
					aria-label="Remove"
					className="shrink-0 text-muted-foreground hover:text-destructive"
				>
					<X size={14} />
				</Button>
			</div>

			<div className="grid grid-cols-2 gap-2">
				<div className="space-y-1">
					<p className="text-xs text-muted-foreground">
						{t("rounds:products.column.foreignPrice")} ({currency})
					</p>
					<Input
						type="number"
						value={row.foreignPrice}
						onChange={(e) => handleUpdate({ foreignPrice: e.target.value })}
						step="1"
						min="0"
						className="text-right font-mono"
					/>
				</div>
				<div className="space-y-1">
					<p className="text-xs text-muted-foreground">
						{t("rounds:products.column.computedThb")}
					</p>
					<div className="h-10 flex items-center justify-end px-3 border border-border rounded-md bg-muted/40">
						<span className="font-mono text-sm text-muted-foreground">
							฿
							{Number(computed).toLocaleString("th-TH", {
								minimumFractionDigits: 2,
							})}
						</span>
					</div>
				</div>
			</div>

			<div className="space-y-1">
				<div className="flex items-center gap-2">
					<p className="text-xs text-muted-foreground">
						{t("rounds:products.column.sellPrice")}
					</p>
					<Checkbox
						id={`override-${row.productId}`}
						checked={row.priceOverridden}
						onCheckedChange={(checked) => {
							if (!checked) {
								const fp = Number(row.foreignPrice);
								const recomputed = computeSellPrice(
									Number.isNaN(fp) ? 0 : fp,
									Number(row.foreignPrice),
									0,
								);
								handleUpdate({
									priceOverridden: false,
									sellPriceThb: recomputed,
								});
							} else {
								handleUpdate({ priceOverridden: true });
							}
						}}
					/>
					<label
						htmlFor={`override-${row.productId}`}
						className="text-xs text-muted-foreground cursor-pointer"
					>
						{t("rounds:products.column.override")}
					</label>
				</div>
				<div className="flex items-center gap-1">
					<span className="text-xs text-muted-foreground">฿</span>
					<Input
						type="number"
						value={row.sellPriceThb}
						onChange={(e) =>
							handleUpdate({
								sellPriceThb: e.target.value,
								priceOverridden: true,
							})
						}
						step="1"
						min="0"
						disabled={!row.priceOverridden}
						className="text-right font-mono"
					/>
				</div>
			</div>

			<div className="space-y-1">
				<p className="text-xs text-muted-foreground">
					{t("rounds:products.column.store")}
				</p>
				<StoreLocationInput
					value={row.storeLocation}
					onChange={(v) => handleUpdate({ storeLocation: v })}
					listId={listId}
				/>
			</div>
		</div>
	);
});

function StoreLocationInput({
	value,
	onChange,
	listId,
	className,
}: {
	value: string;
	onChange: (v: string) => void;
	listId: string;
	className?: string;
}) {
	const [local, setLocal] = useState(value);
	const sentRef = useRef(value);
	const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

	useEffect(() => {
		if (value !== sentRef.current) setLocal(value);
	}, [value]);

	useEffect(() => () => clearTimeout(timerRef.current), []);

	function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
		const v = e.target.value;
		setLocal(v);
		clearTimeout(timerRef.current);
		timerRef.current = setTimeout(() => {
			sentRef.current = v;
			onChange(v);
		}, 300);
	}

	return (
		<Input
			type="text"
			value={local}
			onChange={handleChange}
			list={listId}
			placeholder="—"
			className={cn(className, "w-24")}
		/>
	);
}

const ProductRow = memo(function ProductRow({
	row,
	computed,
	currency,
	listId,
	fromPath,
	onUpdate,
	onRemove,
}: {
	row: DraftRow;
	computed: string;
	currency: string;
	listId: string;
	fromPath: string;
	onUpdate: (productId: string, patch: Partial<DraftRow>) => void;
	onRemove: (productId: string) => void;
}) {
	const handleUpdate = useCallback(
		(patch: Partial<DraftRow>) => onUpdate(row.productId, patch),
		[row.productId, onUpdate],
	);
	const handleRemove = useCallback(
		() => onRemove(row.productId),
		[row.productId, onRemove],
	);
	return (
		<TableRow>
			<TableCell>
				<div className="flex items-center gap-2">
					{row.productThumbUrl ? (
						<img
							src={row.productThumbUrl}
							alt=""
							loading="lazy"
							decoding="async"
							className="w-12 h-12 rounded object-cover shrink-0 bg-muted"
						/>
					) : (
						<div className="w-12 h-12 rounded bg-muted shrink-0" />
					)}
					<div className="min-w-0">
						<Link
							to="/products/$productId"
							params={{ productId: row.productId }}
							search={{ from: fromPath }}
							className="font-medium text-foreground leading-tight underline-offset-2 hover:underline"
						>
							{row.productName}
						</Link>
						{row.productBrand && (
							<p className="text-xs text-muted-foreground">
								{row.productBrand}
							</p>
						)}
					</div>
				</div>
			</TableCell>
			<TableCell className="text-right">
				<div className="flex items-center justify-end gap-1">
					<span className="text-xs text-muted-foreground">{currency}</span>
					<Input
						type="number"
						value={row.foreignPrice}
						onChange={(e) => handleUpdate({ foreignPrice: e.target.value })}
						step="1"
						min="0"
						className="w-28 text-right font-mono h-10 px-2"
					/>
				</div>
			</TableCell>
			<TableCell className="text-right font-mono text-muted-foreground text-sm">
				฿
				{Number(computed).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
			</TableCell>
			<TableCell className="text-right">
				<div className="flex items-center justify-end gap-1">
					<span className="text-xs text-muted-foreground">฿</span>
					<Input
						type="number"
						value={row.sellPriceThb}
						onChange={(e) =>
							handleUpdate({
								sellPriceThb: e.target.value,
								priceOverridden: true,
							})
						}
						step="1"
						min="0"
						disabled={!row.priceOverridden}
						className="w-24 text-right font-mono h-10 px-2"
					/>
				</div>
			</TableCell>
			<TableCell className="text-center">
				<Checkbox
					checked={row.priceOverridden}
					onCheckedChange={(checked) => {
						if (!checked) {
							const fp = Number(row.foreignPrice);
							const recomputed = computeSellPrice(
								Number.isNaN(fp) ? 0 : fp,
								Number(row.foreignPrice),
								0,
							);
							handleUpdate({
								priceOverridden: false,
								sellPriceThb: recomputed,
							});
						} else {
							handleUpdate({ priceOverridden: true });
						}
					}}
				/>
			</TableCell>
			<TableCell>
				<StoreLocationInput
					value={row.storeLocation}
					onChange={(v) => handleUpdate({ storeLocation: v })}
					listId={listId}
					className="h-10 px-2"
				/>
			</TableCell>
			<TableCell>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					onClick={handleRemove}
					aria-label="Remove"
					className="text-muted-foreground hover:text-destructive"
				>
					<X size={14} />
				</Button>
			</TableCell>
		</TableRow>
	);
});

function AutoSaveStatus({
	status,
	onRetry,
	savingLabel,
	savedLabel,
	errorLabel,
}: {
	status: SaveStatus;
	onRetry: () => void;
	savingLabel: string;
	savedLabel: string;
	errorLabel: string;
}) {
	if (status === "idle") return null;
	return (
		<div className="flex items-center gap-1.5 text-xs ml-1 min-w-0">
			{(status === "pending" || status === "saving") && (
				<>
					<Loader2 className="size-3.5 animate-spin text-muted-foreground shrink-0" />
					<span className="text-muted-foreground">{savingLabel}</span>
				</>
			)}
			{status === "saved" && (
				<>
					<Check className="size-3.5 text-emerald-600 dark:text-emerald-500 shrink-0" />
					<span className="text-emerald-600 dark:text-emerald-500">
						{savedLabel}
					</span>
				</>
			)}
			{status === "error" && (
				<button
					type="button"
					onClick={onRetry}
					className="flex items-center gap-1.5 text-destructive hover:underline shrink-0"
				>
					<AlertCircle className="size-3.5" />
					{errorLabel}
				</button>
			)}
		</div>
	);
}
