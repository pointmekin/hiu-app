import { Globe, Package } from "lucide-react";
import type { ProductSuggestion } from "#/server/functions/products/list-suggestions";

interface ProductSuggestionRowProps {
	product: ProductSuggestion;
}

function formatThb(value: number): string {
	return `${value.toLocaleString("th-TH", { maximumFractionDigits: 2 })} ฿`;
}

export function ProductSuggestionRow({ product }: ProductSuggestionRowProps) {
	const referencePrice = product.lastSellPriceThb ?? product.defaultPriceThb;

	return (
		<div className="flex items-center gap-3 min-w-0 flex-1">
			<div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center shrink-0 overflow-hidden">
				{product.thumbUrl ? (
					<img
						src={product.thumbUrl}
						alt=""
						loading="lazy"
						decoding="async"
						className="h-full w-full object-cover"
					/>
				) : (
					<Package size={18} className="text-muted-foreground" />
				)}
			</div>
			<div className="min-w-0 flex-1">
				<p className="font-medium text-foreground truncate">{product.name}</p>
				<p className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
					{product.brand && <span className="truncate">{product.brand}</span>}
					{product.brand && product.sourceCountry && <span>·</span>}
					{product.sourceCountry && (
						<span className="inline-flex items-center gap-1 shrink-0">
							<Globe size={11} />
							{product.sourceCountry}
						</span>
					)}
				</p>
			</div>
			<span className="font-mono text-sm tabular-nums shrink-0 text-foreground">
				{referencePrice != null ? formatThb(referencePrice) : "—"}
			</span>
		</div>
	);
}
