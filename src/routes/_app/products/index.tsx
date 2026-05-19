import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { Package, Plus, X } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { EmptyState } from "#/components/empty-state"
import { Button } from "#/components/ui/button"
import { Card } from "#/components/ui/card"
import { Input } from "#/components/ui/input"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select"
import { formatRelativeDate } from "#/lib/format-relative"
import { useDebounce } from "#/lib/use-debounce"
import type { ProductListCursor, ProductListItem } from "#/server/functions/products/list"
import { listProducts } from "#/server/functions/products/list"
import { listProductFilterOptions } from "#/server/functions/products/list-filter-options"

const PAGE_SIZE = 20

export const Route = createFileRoute("/_app/products/")({
	component: ProductsPage,
})

function ProductsPage() {
	const { t, i18n } = useTranslation("products")
	const [q, setQ] = useState("")
	const debouncedQ = useDebounce(q, 250)
	const [brandFilter, setBrandFilter] = useState("")
	const [categoryFilter, setCategoryFilter] = useState("")
	const [countryFilter, setCountryFilter] = useState("")

	const hasActiveFilter = Boolean(brandFilter || categoryFilter || countryFilter)

	const { data: filterOptions } = useQuery({
		queryKey: ["products", "filter-options"],
		queryFn: () => listProductFilterOptions(),
		staleTime: 5 * 60 * 1000,
	})

	const query = useInfiniteQuery({
		queryKey: ["products", "list", debouncedQ, brandFilter, categoryFilter, countryFilter],
		queryFn: ({ pageParam }: { pageParam: ProductListCursor | null }) =>
			listProducts({
				data: {
					q: debouncedQ,
					limit: PAGE_SIZE,
					cursor: pageParam ?? undefined,
					brand: brandFilter || undefined,
					category: categoryFilter || undefined,
					sourceCountry: countryFilter || undefined,
				},
			}),
		initialPageParam: null as ProductListCursor | null,
		getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
		placeholderData: keepPreviousData,
	})

	const products = query.data?.pages.flatMap((p) => p.items) ?? []

	const brands = filterOptions?.brands ?? []
	const categories = filterOptions?.categories ?? []
	const countries = filterOptions?.sourceCountries ?? []
	const showFilters = brands.length > 0 || categories.length > 0 || countries.length > 0

	function clearFilters() {
		setBrandFilter("")
		setCategoryFilter("")
		setCountryFilter("")
	}

	return (
		<div className="max-w-5xl mx-auto px-4 py-6">
			<div className="flex items-center justify-between mb-6">
				<h1 className="text-2xl font-semibold text-foreground">
					{t("list.title")}
				</h1>
				<Button asChild variant="default">
					<Link to="/products/$productId" params={{ productId: "new" }}>
						<Plus size={16} />
						{t("list.addFirst")}
					</Link>
				</Button>
			</div>

			<Input
				type="text"
				value={q}
				onChange={(e) => setQ(e.target.value)}
				placeholder={t("list.search")}
				className="mb-2"
			/>

			{showFilters && (
				<div className="mb-4 space-y-2">
					<div className="grid grid-cols-3 gap-2">
						{brands.length > 0 && (
							<Select
								value={brandFilter || "__all__"}
								onValueChange={(v) => setBrandFilter(v === "__all__" ? "" : v)}
							>
								<SelectTrigger className="h-8 text-xs">
									<SelectValue placeholder={t("field.brand")} />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="__all__">{t("field.brand")}</SelectItem>
									{brands.map((b) => (
										<SelectItem key={b} value={b}>{b}</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
						{categories.length > 0 && (
							<Select
								value={categoryFilter || "__all__"}
								onValueChange={(v) => setCategoryFilter(v === "__all__" ? "" : v)}
							>
								<SelectTrigger className="h-8 text-xs">
									<SelectValue placeholder={t("field.category")} />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="__all__">{t("field.category")}</SelectItem>
									{categories.map((c) => (
										<SelectItem key={c} value={c}>{c}</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
						{countries.length > 0 && (
							<Select
								value={countryFilter || "__all__"}
								onValueChange={(v) => setCountryFilter(v === "__all__" ? "" : v)}
							>
								<SelectTrigger className="h-8 text-xs">
									<SelectValue placeholder={t("field.sourceCountry")} />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="__all__">{t("field.sourceCountry")}</SelectItem>
									{countries.map((c) => (
										<SelectItem key={c} value={c}>{c}</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
					</div>

					{hasActiveFilter && (
						<button
							type="button"
							onClick={clearFilters}
							className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
						>
							<X size={12} />
							{t("filter.clearFilters")}
						</button>
					)}
				</div>
			)}

			{products.length === 0 && !query.isFetching ? (
				<EmptyState
					icon={<Package size={32} className="text-ink-muted" />}
					title={t("list.empty")}
					hint={t("list.emptyHint")}
				/>
			) : (
				<>
					<ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
						{products.map((product) => (
							<li key={product.id}>
								<Link
									to="/products/$productId"
									params={{ productId: product.id }}
									className="block h-full"
								>
									<ProductCard product={product} locale={i18n.language} />
								</Link>
							</li>
						))}
					</ul>

					{query.hasNextPage && (
						<div className="mt-6 flex justify-center">
							<Button
								variant="outline"
								size="sm"
								onClick={() => query.fetchNextPage()}
								disabled={query.isFetchingNextPage}
							>
								{query.isFetchingNextPage ? t("common:loading") : t("list.loadMore")}
							</Button>
						</div>
					)}
				</>
			)}
		</div>
	)
}

interface ProductCardProps {
	product: ProductListItem
	locale: string
}

function ProductCard({ product, locale }: ProductCardProps) {
	const meta = [product.brand, product.category, product.sourceCountry]
		.filter(Boolean)
		.join(" · ")

	const relDate = formatRelativeDate(product.lastUsedAt, locale)

	return (
		<Card className="flex flex-row items-center gap-3 px-3 py-3 hover:bg-accent/50 transition-colors min-h-[56px]">
			<div className="size-12 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
				{product.thumbUrl ? (
					<img
						src={product.thumbUrl}
						alt=""
						className="h-full w-full object-cover"
					/>
				) : (
					<Package size={20} className="text-muted-foreground" />
				)}
			</div>

			<div className="flex-1 min-w-0">
				<p className="font-medium text-foreground leading-tight truncate text-[15px]">
					{product.name}
				</p>
				{meta && (
					<p className="text-xs text-muted-foreground mt-0.5 truncate">
						{meta}
					</p>
				)}
			</div>

			{relDate && (
				<p className="text-xs text-muted-foreground shrink-0 tabular-nums">
					{relDate}
				</p>
			)}
		</Card>
	)
}
