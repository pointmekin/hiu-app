import { Globe, Package } from "lucide-react";

interface ProductPickerRowProps {
	name: string;
	brand: string | null;
	sourceCountry: string | null;
	thumbUrl: string | null;
	priceThb: number | null;
}

function formatThb(value: number): string {
	return `${value.toLocaleString("th-TH", { maximumFractionDigits: 2 })} ฿`;
}

export function ProductPickerRow({
	name,
	brand,
	sourceCountry,
	thumbUrl,
	priceThb,
}: ProductPickerRowProps) {
	return (
		<div className="flex items-center gap-3 min-w-0 flex-1">
			<div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center shrink-0 overflow-hidden">
				{thumbUrl ? (
					<img
						src={thumbUrl}
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
				<p className="font-medium text-foreground truncate">{name}</p>
				<p className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
					{brand && <span className="truncate">{brand}</span>}
					{brand && sourceCountry && <span>·</span>}
					{sourceCountry && (
						<span className="inline-flex items-center gap-1 shrink-0">
							<Globe size={11} />
							{sourceCountry}
						</span>
					)}
				</p>
			</div>
			<span className="font-mono text-sm tabular-nums shrink-0 text-foreground">
				{priceThb != null && Number.isFinite(priceThb)
					? formatThb(priceThb)
					: "—"}
			</span>
		</div>
	);
}
