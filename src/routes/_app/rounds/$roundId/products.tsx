import {
	useMutation,
	useQuery,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { Package, Plus, RefreshCw, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Product } from "#/db/schema";
import { listProducts } from "#/server/functions/products/list";
import { listRoundProducts } from "#/server/functions/round-products/list";
import { recomputeFromFx } from "#/server/functions/round-products/recompute-from-fx";
import { upsertRoundProducts } from "#/server/functions/round-products/upsert-many";
import { getRound } from "#/server/functions/rounds/get";

export const Route = createFileRoute("/_app/rounds/$roundId/products")({
	loader: async ({ context: { queryClient }, params }) => {
		await Promise.all([
			queryClient.ensureQueryData({
				queryKey: ["rounds", params.roundId],
				queryFn: () => getRound({ data: { id: params.roundId } }),
			}),
			queryClient.ensureQueryData({
				queryKey: ["round-products", params.roundId],
				queryFn: () =>
					listRoundProducts({ data: { roundId: params.roundId } }),
			}),
		]);
	},
	component: RoundProductsPage,
});

interface DraftRow {
	productId: string;
	productName: string;
	productBrand: string | null;
	foreignPrice: string;
	sellPriceThb: string;
	priceOverridden: boolean;
	storeLocation: string;
}

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

	const { data: round } = useSuspenseQuery({
		queryKey: ["rounds", roundId],
		queryFn: () => getRound({ data: { id: roundId } }),
	});

	const { data: roundProductRows } = useSuspenseQuery({
		queryKey: ["round-products", roundId],
		queryFn: () => listRoundProducts({ data: { roundId } }),
	});

	const fxRate = Number(round.fxRate);
	const perItemFee = Number(round.perItemFeeTh);

	const [rows, setRows] = useState<DraftRow[]>(() =>
		roundProductRows.map((rp) => ({
			productId: rp.productId,
			productName: rp.productName,
			productBrand: rp.productBrand,
			foreignPrice: rp.foreignPrice,
			sellPriceThb: rp.sellPriceThb,
			priceOverridden: rp.priceOverridden,
			storeLocation: rp.storeLocation ?? "",
		})),
	);

	useEffect(() => {
		setRows(
			roundProductRows.map((rp) => ({
				productId: rp.productId,
				productName: rp.productName,
				productBrand: rp.productBrand,
				foreignPrice: rp.foreignPrice,
				sellPriceThb: rp.sellPriceThb,
				priceOverridden: rp.priceOverridden,
				storeLocation: rp.storeLocation ?? "",
			})),
		);
	}, [roundProductRows]);

	const [showCatalog, setShowCatalog] = useState(false);
	const [isDirty, setIsDirty] = useState(false);

	function updateRow(index: number, patch: Partial<DraftRow>) {
		setRows((prev) => {
			const next = prev.map((row, i) => {
				if (i !== index) return row;
				const updated = { ...row, ...patch };
				if ("foreignPrice" in patch && !updated.priceOverridden) {
					const fp = Number(patch.foreignPrice);
					if (!Number.isNaN(fp) && fp > 0) {
						updated.sellPriceThb = computeSellPrice(fp, fxRate, perItemFee);
					}
				}
				return updated;
			});
			return next;
		});
		setIsDirty(true);
	}

	function removeRow(index: number) {
		setRows((prev) => prev.filter((_, i) => i !== index));
		setIsDirty(true);
	}

	function addFromCatalog(product: Product) {
		const alreadyAdded = rows.some((r) => r.productId === product.id);
		if (alreadyAdded) return;
		setRows((prev) => [
			...prev,
			{
				productId: product.id,
				productName: product.name,
				productBrand: product.brand,
				foreignPrice: "0",
				sellPriceThb: "0",
				priceOverridden: false,
				storeLocation: "",
			},
		]);
		setIsDirty(true);
		setShowCatalog(false);
	}

	const saveMutation = useMutation({
		mutationFn: () =>
			upsertRoundProducts({
				data: {
					roundId,
					rows: rows.map((r) => ({
						productId: r.productId,
						foreignPrice: Number(r.foreignPrice) || 0,
						sellPriceThb: Number(r.sellPriceThb) || 0,
						priceOverridden: r.priceOverridden,
						storeLocation: r.storeLocation || undefined,
					})),
				},
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["round-products", roundId],
			});
			setIsDirty(false);
		},
	});

	const recomputeMutation = useMutation({
		mutationFn: () => recomputeFromFx({ data: { roundId } }),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["round-products", roundId],
			});
		},
	});

	if (rows.length === 0 && !showCatalog) {
		return (
			<div className="flex flex-col items-center justify-center py-16 text-center">
				<div className="rounded-full bg-bone-soft p-5 mb-4">
					<Package size={32} className="text-ink-muted" />
				</div>
				<p className="text-lg font-medium text-foreground mb-1">
					{t("rounds:products.empty")}
				</p>
				<p className="text-sm text-muted-foreground mb-6">
					{t("rounds:products.emptyHint")}
				</p>
				<button
					type="button"
					onClick={() => setShowCatalog(true)}
					className="flex items-center gap-2 rounded-md bg-hanko px-4 py-2.5 text-sm font-semibold text-bone hover:bg-hanko-hover"
				>
					<Plus size={16} />
					{t("rounds:products.addProduct")}
				</button>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between gap-3 flex-wrap">
				<div className="text-sm text-muted-foreground">
					{round.sourceCurrency} @ {fxRate.toFixed(4)}
					{perItemFee > 0 && ` + ฿${perItemFee}`}
				</div>
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={() => recomputeMutation.mutate()}
						disabled={recomputeMutation.isPending}
						title={t("rounds:products.recomputeHint")}
						className="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
					>
						<RefreshCw size={14} />
						{t("rounds:products.recompute")}
					</button>
					<button
						type="button"
						onClick={() => setShowCatalog(true)}
						className="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent"
					>
						<Plus size={14} />
						{t("rounds:products.addProduct")}
					</button>
					<button
						type="button"
						onClick={() => saveMutation.mutate()}
						disabled={!isDirty || saveMutation.isPending}
						className="flex items-center gap-1.5 rounded-md bg-hanko px-3 py-2 text-sm font-medium text-bone hover:bg-hanko-hover disabled:opacity-50"
					>
						<Save size={14} />
						{saveMutation.isPending
							? t("common:loading")
							: t("rounds:products.saveAll")}
					</button>
				</div>
			</div>

			{saveMutation.error && (
				<p className="text-sm text-destructive">
					{(saveMutation.error as Error).message}
				</p>
			)}

			<div className="overflow-x-auto rounded-lg border border-border">
				<table className="w-full text-sm">
					<thead>
						<tr className="border-b border-border bg-muted/40">
							<th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
								{t("rounds:products.column.product")}
							</th>
							<th className="px-3 py-2.5 text-right font-medium text-muted-foreground w-28">
								{t("rounds:products.column.foreignPrice")}
							</th>
							<th className="px-3 py-2.5 text-right font-medium text-muted-foreground w-28">
								{t("rounds:products.column.computedThb")}
							</th>
							<th className="px-3 py-2.5 text-right font-medium text-muted-foreground w-28">
								{t("rounds:products.column.sellPrice")}
							</th>
							<th className="px-3 py-2.5 text-center font-medium text-muted-foreground w-20">
								{t("rounds:products.column.override")}
							</th>
							<th className="px-3 py-2.5 text-left font-medium text-muted-foreground w-36">
								{t("rounds:products.column.store")}
							</th>
							<th className="w-8" />
						</tr>
					</thead>
					<tbody>
						{rows.map((row, index) => {
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
									onUpdate={(patch) => updateRow(index, patch)}
									onRemove={() => removeRow(index)}
								/>
							);
						})}
					</tbody>
				</table>
			</div>

			{showCatalog && (
				<CatalogPicker
					onSelect={addFromCatalog}
					onClose={() => setShowCatalog(false)}
					excludeIds={rows.map((r) => r.productId)}
				/>
			)}
		</div>
	);
}

function ProductRow({
	row,
	computed,
	currency,
	onUpdate,
	onRemove,
}: {
	row: DraftRow;
	computed: string;
	currency: string;
	onUpdate: (patch: Partial<DraftRow>) => void;
	onRemove: () => void;
}) {
	return (
		<tr className="border-b border-border last:border-0 hover:bg-accent/20">
			<td className="px-3 py-2">
				<p className="font-medium text-foreground leading-tight">
					{row.productName}
				</p>
				{row.productBrand && (
					<p className="text-xs text-muted-foreground">{row.productBrand}</p>
				)}
			</td>
			<td className="px-3 py-2 text-right">
				<div className="flex items-center justify-end gap-1">
					<span className="text-xs text-muted-foreground">{currency}</span>
					<input
						type="number"
						value={row.foreignPrice}
						onChange={(e) => onUpdate({ foreignPrice: e.target.value })}
						step="1"
						min="0"
						className="w-20 text-right rounded border border-border bg-background px-2 py-1 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
					/>
				</div>
			</td>
			<td className="px-3 py-2 text-right font-mono text-muted-foreground text-sm">
				฿{Number(computed).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
			</td>
			<td className="px-3 py-2 text-right">
				<div className="flex items-center justify-end gap-1">
					<span className="text-xs text-muted-foreground">฿</span>
					<input
						type="number"
						value={row.sellPriceThb}
						onChange={(e) =>
							onUpdate({
								sellPriceThb: e.target.value,
								priceOverridden: true,
							})
						}
						step="1"
						min="0"
						disabled={!row.priceOverridden}
						className="w-20 text-right rounded border border-border bg-background px-2 py-1 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
					/>
				</div>
			</td>
			<td className="px-3 py-2 text-center">
				<input
					type="checkbox"
					checked={row.priceOverridden}
					onChange={(e) => {
						const override = e.target.checked;
						if (!override) {
							const fp = Number(row.foreignPrice);
							const recomputed = computeSellPrice(
								Number.isNaN(fp) ? 0 : fp,
								Number(row.foreignPrice),
								0,
							);
							onUpdate({ priceOverridden: false, sellPriceThb: recomputed });
						} else {
							onUpdate({ priceOverridden: true });
						}
					}}
					className="rounded border-border"
				/>
			</td>
			<td className="px-3 py-2">
				<input
					type="text"
					value={row.storeLocation}
					onChange={(e) => onUpdate({ storeLocation: e.target.value })}
					placeholder="—"
					className="w-full rounded border border-border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
				/>
			</td>
			<td className="px-2 py-2">
				<button
					type="button"
					onClick={onRemove}
					className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded"
					aria-label="Remove"
				>
					✕
				</button>
			</td>
		</tr>
	);
}

function CatalogPicker({
	onSelect,
	onClose,
	excludeIds,
}: {
	onSelect: (product: Product) => void;
	onClose: () => void;
	excludeIds: string[];
}) {
	const { t } = useTranslation(["rounds", "products"]);
	const [q, setQ] = useState("");

	const { data: allProducts = [] } = useQuery({
		queryKey: ["products", q],
		queryFn: () => listProducts({ data: { q, limit: 30 } }),
	});

	const available = allProducts.filter((p) => !excludeIds.includes(p.id));

	return (
		<div
			className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50"
			onClick={(e) => e.target === e.currentTarget && onClose()}
			onKeyDown={(e) => e.key === "Escape" && onClose()}
		>
			<div className="bg-card rounded-t-2xl md:rounded-2xl w-full max-w-md max-h-[70vh] flex flex-col shadow-xl">
				<div className="px-4 py-3 border-b border-border">
					<h3 className="font-semibold text-foreground">
						{t("rounds:products.addProduct")}
					</h3>
					<input
						autoFocus
						type="text"
						value={q}
						onChange={(e) => setQ(e.target.value)}
						placeholder={t("rounds:products.searchCatalog")}
						className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-ring"
						style={{ fontSize: "16px" }}
					/>
				</div>
				<ul className="overflow-y-auto flex-1 divide-y divide-border">
					{available.length === 0 ? (
						<li className="px-4 py-8 text-center text-sm text-muted-foreground">
							{t("products:list.empty")}
						</li>
					) : (
						available.map((product) => (
							<li key={product.id}>
								<button
									type="button"
									onClick={() => onSelect(product)}
									className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/50 text-left"
								>
									<div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center shrink-0 overflow-hidden">
										{product.thumbUrl ? (
											<img
												src={product.thumbUrl}
												alt=""
												className="h-full w-full object-cover"
											/>
										) : (
											<Package size={18} className="text-muted-foreground" />
										)}
									</div>
									<div className="min-w-0">
										<p className="font-medium text-foreground truncate">
											{product.name}
										</p>
										{product.brand && (
											<p className="text-xs text-muted-foreground">
												{product.brand}
											</p>
										)}
									</div>
								</button>
							</li>
						))
					)}
				</ul>
				<div className="px-4 py-3 border-t border-border">
					<button
						type="button"
						onClick={onClose}
						className="w-full rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
					>
						{t("common:action.cancel")}
					</button>
				</div>
			</div>
		</div>
	);
}
