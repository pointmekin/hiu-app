import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { Package, Plus } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { EmptyState } from "#/components/empty-state"
import { Button } from "#/components/ui/button"
import { Card } from "#/components/ui/card"
import { Input } from "#/components/ui/input"
import { formatRelativeDate } from "#/lib/format-relative"
import { useDebounce } from "#/lib/use-debounce"
import type { ProductListCursor, ProductListItem } from "#/server/functions/products/list"
import { listProducts } from "#/server/functions/products/list"

const PAGE_SIZE = 20

export const Route = createFileRoute("/_app/products/")({
	component: ProductsPage,
})

function ProductsPage() {
	const { t, i18n } = useTranslation("products")
	const [q, setQ] = useState("")
	const debouncedQ = useDebounce(q, 250)

	const query = useInfiniteQuery({
		queryKey: ["products", "list", debouncedQ],
		queryFn: ({ pageParam }: { pageParam: ProductListCursor | null }) =>
			listProducts({ data: { q: debouncedQ, limit: PAGE_SIZE, cursor: pageParam ?? undefined } }),
		initialPageParam: null as ProductListCursor | null,
		getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
		placeholderData: keepPreviousData,
	})

	const products = query.data?.pages.flatMap((p) => p.items) ?? []

	return (
		<div className="max-w-2xl mx-auto px-4 py-6">
			<div className="flex items-center justify-between mb-6">
				<h1 className="text-2xl font-semibold text-foreground">
					{t("list.title")}
				</h1>
				<Button asChild variant="brand">
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
				className="mb-4"
			/>

			{products.length === 0 && !query.isFetching ? (
				<EmptyState
					icon={<Package size={32} className="text-ink-muted" />}
					title={t("list.empty")}
					hint={t("list.emptyHint")}
				/>
			) : (
				<>
					<ul className="space-y-2">
						{products.map((product) => (
							<li key={product.id}>
								<Link
									to="/products/$productId"
									params={{ productId: product.id }}
									className="block"
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
