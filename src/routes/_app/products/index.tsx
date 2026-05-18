import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Package, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useDebounce } from "#/lib/use-debounce";
import { listProducts } from "#/server/functions/products/list";

export const Route = createFileRoute("/_app/products/")({
	loader: async ({ context: { queryClient } }) => {
		await queryClient.ensureQueryData({
			queryKey: ["products", ""],
			queryFn: () => listProducts({ data: { q: "", limit: 50 } }),
		});
	},
	component: ProductsPage,
});

function ProductsPage() {
	const { t } = useTranslation("products");
	const [q, setQ] = useState("");
	const debouncedQ = useDebounce(q, 250);

	const { data: products = [] } = useQuery({
		queryKey: ["products", debouncedQ],
		queryFn: () => listProducts({ data: { q: debouncedQ, limit: 50 } }),
		placeholderData: keepPreviousData,
	});

	return (
		<div className="max-w-2xl mx-auto px-4 py-6">
			<div className="flex items-center justify-between mb-6">
				<h1 className="text-2xl font-semibold text-foreground">
					{t("list.title")}
				</h1>
				<Link
					to="/products/$productId"
					params={{ productId: "new" }}
					className="flex items-center gap-2 rounded-md bg-hanko px-3 py-2 text-sm font-medium text-bone hover:bg-hanko-hover transition-colors"
				>
					<Plus size={16} />
					{t("list.addFirst")}
				</Link>
			</div>

			<input
				type="text"
				value={q}
				onChange={(e) => setQ(e.target.value)}
				placeholder={t("list.search")}
				className="w-full rounded-md border border-border bg-background px-3 py-2 mb-4 text-base focus:outline-none focus:ring-2 focus:ring-ring"
				style={{ fontSize: "16px" }}
			/>

			{products.length === 0 ? (
				<div className="flex flex-col items-center justify-center py-20 text-center">
					<div className="rounded-full bg-bone-soft p-5 mb-4">
						<Package size={32} className="text-ink-muted" />
					</div>
					<p className="text-lg font-medium text-foreground mb-1">
						{t("list.empty")}
					</p>
					<p className="text-sm text-muted-foreground">{t("list.emptyHint")}</p>
				</div>
			) : (
				<ul className="space-y-2">
					{products.map((product) => (
						<li key={product.id}>
							<Link
								to="/products/$productId"
								params={{ productId: product.id }}
								className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 hover:bg-accent/50 transition-colors"
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
									<p className="text-xs text-muted-foreground mt-0.5">
										{[product.brand, product.category, product.sourceCountry]
											.filter(Boolean)
											.join(" · ")}
									</p>
								</div>
							</Link>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
