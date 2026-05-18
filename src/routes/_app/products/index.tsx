import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { Package, Plus } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { EmptyState } from "#/components/empty-state"
import { Button } from "#/components/ui/button"
import { Card } from "#/components/ui/card"
import { Input } from "#/components/ui/input"
import { useDebounce } from "#/lib/use-debounce"
import { listProducts } from "#/server/functions/products/list"

export const Route = createFileRoute("/_app/products/")({
	loader: async ({ context: { queryClient } }) => {
		await queryClient.ensureQueryData({
			queryKey: ["products", ""],
			queryFn: () => listProducts({ data: { q: "", limit: 50 } }),
		})
	},
	component: ProductsPage,
})

function ProductsPage() {
	const { t } = useTranslation("products")
	const [q, setQ] = useState("")
	const debouncedQ = useDebounce(q, 250)

	const { data: products = [] } = useQuery({
		queryKey: ["products", debouncedQ],
		queryFn: () => listProducts({ data: { q: debouncedQ, limit: 50 } }),
		placeholderData: keepPreviousData,
	})

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

			{products.length === 0 ? (
				<EmptyState
					icon={<Package size={32} className="text-ink-muted" />}
					title={t("list.empty")}
					hint={t("list.emptyHint")}
				/>
			) : (
				<ul className="space-y-2">
					{products.map((product) => (
						<li key={product.id}>
							<Link
								to="/products/$productId"
								params={{ productId: product.id }}
								className="block"
							>
								<Card className="flex flex-row items-start gap-3 px-4 py-3 hover:bg-accent/50 transition-colors">
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
										<p className="text-xs text-muted-foreground mt-0.5">
											{[product.brand, product.category, product.sourceCountry]
												.filter(Boolean)
												.join(" · ")}
										</p>
									</div>
								</Card>
							</Link>
						</li>
					))}
				</ul>
			)}
		</div>
	)
}
