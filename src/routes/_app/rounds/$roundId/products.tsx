import {
	useMutation,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query"
import { createFileRoute, Link, useParams } from "@tanstack/react-router"
import { Package, Plus, RefreshCw, Save, X } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import type { ProductListItem } from "#/server/functions/products/list"
import { listRoundProducts } from "#/server/functions/round-products/list"
import { recomputeFromFx } from "#/server/functions/round-products/recompute-from-fx"
import { upsertRoundProducts } from "#/server/functions/round-products/upsert-many"
import { getRound } from "#/server/functions/rounds/get"
import { Alert, AlertDescription } from "#/components/ui/alert"
import { Button } from "#/components/ui/button"
import { Checkbox } from "#/components/ui/checkbox"
import { Input } from "#/components/ui/input"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "#/components/ui/table"
import { CatalogPickerDialog } from "#/components/catalog-picker-dialog"
import { EmptyState } from "#/components/empty-state"

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
		])
	},
	component: RoundProductsPage,
})

interface DraftRow {
	productId: string
	productName: string
	productBrand: string | null
	productThumbUrl: string | null
	foreignPrice: string
	sellPriceThb: string
	priceOverridden: boolean
	storeLocation: string
}

function computeSellPrice(
	foreignPrice: number,
	fxRate: number,
	perItemFee: number,
): string {
	return (foreignPrice * fxRate + perItemFee).toFixed(2)
}

function RoundProductsPage() {
	const { t } = useTranslation(["rounds", "common"])
	const { roundId } = useParams({ from: "/_app/rounds/$roundId/products" })
	const queryClient = useQueryClient()

	const { data: round } = useSuspenseQuery({
		queryKey: ["rounds", roundId],
		queryFn: () => getRound({ data: { id: roundId } }),
	})

	const { data: roundProductRows } = useSuspenseQuery({
		queryKey: ["round-products", roundId],
		queryFn: () => listRoundProducts({ data: { roundId } }),
	})

	const fxRate = Number(round.fxRate)
	const perItemFee = Number(round.perItemFeeTh)

	const [rows, setRows] = useState<DraftRow[]>(() =>
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
	)

	useEffect(() => {
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
		)
	}, [roundProductRows])

	const [showCatalog, setShowCatalog] = useState(false)
	const [isDirty, setIsDirty] = useState(false)

	function updateRow(index: number, patch: Partial<DraftRow>) {
		setRows((prev) => {
			const next = prev.map((row, i) => {
				if (i !== index) return row
				const updated = { ...row, ...patch }
				if ("foreignPrice" in patch && !updated.priceOverridden) {
					const fp = Number(patch.foreignPrice)
					if (!Number.isNaN(fp) && fp > 0) {
						updated.sellPriceThb = computeSellPrice(fp, fxRate, perItemFee)
					}
				}
				return updated
			})
			return next
		})
		setIsDirty(true)
	}

	function removeRow(index: number) {
		setRows((prev) => prev.filter((_, i) => i !== index))
		setIsDirty(true)
	}

	function addFromCatalog(product: ProductListItem) {
		const alreadyAdded = rows.some((r) => r.productId === product.id)
		if (alreadyAdded) return
		setRows((prev) => [
			...prev,
			{
				productId: product.id,
				productName: product.name,
				productBrand: product.brand,
				productThumbUrl: null,
				foreignPrice: "0",
				sellPriceThb: "0",
				priceOverridden: false,
				storeLocation: "",
			},
		])
		setIsDirty(true)
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
			})
			setIsDirty(false)
		},
	})

	const recomputeMutation = useMutation({
		mutationFn: () => recomputeFromFx({ data: { roundId } }),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["round-products", roundId],
			})
		},
	})

	if (rows.length === 0) {
		return (
			<>
				<EmptyState
					icon={<Package size={32} className="text-ink-muted" />}
					title={t("rounds:products.empty")}
					hint={t("rounds:products.emptyHint")}
					action={
						<Button variant="brand" onClick={() => setShowCatalog(true)}>
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
				/>
			</>
		)
	}

	return (
		<div className="space-y-4">
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
				<div className="text-sm text-muted-foreground">
					{round.sourceCurrency} @ {fxRate.toFixed(4)}
					{perItemFee > 0 && ` + ฿${perItemFee}`}
				</div>
				<div className="flex items-center gap-2 flex-wrap">
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
						variant="brand"
						size="sm"
						onClick={() => saveMutation.mutate()}
						disabled={!isDirty || saveMutation.isPending}
					>
						<Save size={14} />
						{saveMutation.isPending
							? t("common:loading")
							: t("rounds:products.saveAll")}
					</Button>
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
				{rows.map((row, index) => {
					const fp = Number(row.foreignPrice)
					const computed = computeSellPrice(
						Number.isNaN(fp) ? 0 : fp,
						fxRate,
						perItemFee,
					)
					return (
						<MobileProductCard
							key={row.productId}
							row={row}
							computed={computed}
							currency={round.sourceCurrency}
							onUpdate={(patch) => updateRow(index, patch)}
							onRemove={() => removeRow(index)}
						/>
					)
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
						{rows.map((row, index) => {
							const fp = Number(row.foreignPrice)
							const computed = computeSellPrice(
								Number.isNaN(fp) ? 0 : fp,
								fxRate,
								perItemFee,
							)
							return (
								<ProductRow
									key={row.productId}
									row={row}
									computed={computed}
									currency={round.sourceCurrency}
									onUpdate={(patch) => updateRow(index, patch)}
									onRemove={() => removeRow(index)}
								/>
							)
						})}
					</TableBody>
				</Table>
			</div>

			<CatalogPickerDialog
				open={showCatalog}
				onOpenChange={setShowCatalog}
				excludeIds={rows.map((r) => r.productId)}
				onSelect={addFromCatalog}
			/>
		</div>
	)
}

function MobileProductCard({
	row,
	computed,
	currency,
	onUpdate,
	onRemove,
}: {
	row: DraftRow
	computed: string
	currency: string
	onUpdate: (patch: Partial<DraftRow>) => void
	onRemove: () => void
}) {
	const { t } = useTranslation(["rounds"])
	return (
		<div className="border border-border rounded-lg p-3 space-y-3 bg-card">
			<div className="flex items-start justify-between gap-2">
				<div className="flex items-center gap-2 min-w-0">
					{row.productThumbUrl ? (
						<img
							src={row.productThumbUrl}
							alt=""
							className="w-16 h-16 rounded object-cover shrink-0 bg-muted"
						/>
					) : (
						<div className="w-16 h-16 rounded bg-muted shrink-0" />
					)}
					<div className="min-w-0">
						<Link
							to="/products/$productId"
							params={{ productId: row.productId }}
							className="font-medium text-foreground leading-tight underline-offset-2 hover:underline"
						>
							{row.productName}
						</Link>
						{row.productBrand && (
							<p className="text-xs text-muted-foreground">{row.productBrand}</p>
						)}
					</div>
				</div>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					onClick={onRemove}
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
						onChange={(e) => onUpdate({ foreignPrice: e.target.value })}
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
							฿{Number(computed).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
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
								const fp = Number(row.foreignPrice)
								const recomputed = computeSellPrice(
									Number.isNaN(fp) ? 0 : fp,
									Number(row.foreignPrice),
									0,
								)
								onUpdate({ priceOverridden: false, sellPriceThb: recomputed })
							} else {
								onUpdate({ priceOverridden: true })
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
							onUpdate({ sellPriceThb: e.target.value, priceOverridden: true })
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
				<Input
					type="text"
					value={row.storeLocation}
					onChange={(e) => onUpdate({ storeLocation: e.target.value })}
					placeholder="—"
				/>
			</div>
		</div>
	)
}

function ProductRow({
	row,
	computed,
	currency,
	onUpdate,
	onRemove,
}: {
	row: DraftRow
	computed: string
	currency: string
	onUpdate: (patch: Partial<DraftRow>) => void
	onRemove: () => void
}) {
	return (
		<TableRow>
			<TableCell>
				<div className="flex items-center gap-2">
					{row.productThumbUrl ? (
						<img
							src={row.productThumbUrl}
							alt=""
							className="w-12 h-12 rounded object-cover shrink-0 bg-muted"
						/>
					) : (
						<div className="w-12 h-12 rounded bg-muted shrink-0" />
					)}
					<div className="min-w-0">
						<Link
							to="/products/$productId"
							params={{ productId: row.productId }}
							className="font-medium text-foreground leading-tight underline-offset-2 hover:underline"
						>
							{row.productName}
						</Link>
						{row.productBrand && (
							<p className="text-xs text-muted-foreground">{row.productBrand}</p>
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
						onChange={(e) => onUpdate({ foreignPrice: e.target.value })}
						step="1"
						min="0"
						className="w-20 text-right font-mono h-10 px-2"
					/>
				</div>
			</TableCell>
			<TableCell className="text-right font-mono text-muted-foreground text-sm">
				฿{Number(computed).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
			</TableCell>
			<TableCell className="text-right">
				<div className="flex items-center justify-end gap-1">
					<span className="text-xs text-muted-foreground">฿</span>
					<Input
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
						className="w-20 text-right font-mono h-10 px-2"
					/>
				</div>
			</TableCell>
			<TableCell className="text-center">
				<Checkbox
					checked={row.priceOverridden}
					onCheckedChange={(checked) => {
						if (!checked) {
							const fp = Number(row.foreignPrice)
							const recomputed = computeSellPrice(
								Number.isNaN(fp) ? 0 : fp,
								Number(row.foreignPrice),
								0,
							)
							onUpdate({ priceOverridden: false, sellPriceThb: recomputed })
						} else {
							onUpdate({ priceOverridden: true })
						}
					}}
				/>
			</TableCell>
			<TableCell>
				<Input
					type="text"
					value={row.storeLocation}
					onChange={(e) => onUpdate({ storeLocation: e.target.value })}
					placeholder="—"
					className="h-10 px-2"
				/>
			</TableCell>
			<TableCell>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					onClick={onRemove}
					aria-label="Remove"
					className="text-muted-foreground hover:text-destructive"
				>
					<X size={14} />
				</Button>
			</TableCell>
		</TableRow>
	)
}
