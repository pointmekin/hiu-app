import { useQuery } from "@tanstack/react-query";
import { Loader2, PlusCircle } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ProductPickerRow } from "#/components/product-picker-row";
import {
	Command,
	CommandEmpty,
	CommandInput,
	CommandItem,
	CommandList,
} from "#/components/ui/command";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { Skeleton } from "#/components/ui/skeleton";
import { useDebounce } from "#/lib/use-debounce";
import { useKeyboardInset } from "#/lib/use-keyboard-inset";
import {
	listProductSuggestions,
	type ProductSuggestion,
} from "#/server/functions/products/list-suggestions";

interface CatalogPickerDialogProps {
	roundId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	excludeIds: string[];
	onSelect: (product: ProductSuggestion) => void;
	onCreateNew?: (query: string) => void;
}

export function CatalogPickerDialog({
	roundId,
	open,
	onOpenChange,
	excludeIds,
	onSelect,
	onCreateNew,
}: CatalogPickerDialogProps) {
	const { t } = useTranslation(["rounds", "products"]);
	const [q, setQ] = useState("");
	const debouncedQ = useDebounce(q, 250);
	const keyboardInset = useKeyboardInset();

	const { data, isFetching } = useQuery({
		queryKey: ["product-suggestions", roundId, "with-current", debouncedQ],
		queryFn: () =>
			listProductSuggestions({
				data: { roundId, q: debouncedQ, limit: 30, includeCurrentRound: true },
			}),
		enabled: open,
	});

	const available = (data ?? []).filter((p) => !excludeIds.includes(p.id));

	function handleSelect(product: ProductSuggestion) {
		onSelect(product);
		onOpenChange(false);
		setQ("");
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="top-auto bottom-0 left-0 right-0 translate-x-0 translate-y-0 max-w-none rounded-t-2xl rounded-b-none data-[state=open]:slide-in-from-bottom-4 sm:bottom-auto sm:left-[50%] sm:top-[50%] sm:right-auto sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-md sm:rounded-2xl sm:data-[state=open]:slide-in-from-bottom-0 p-0"
				style={keyboardInset > 0 ? { bottom: keyboardInset } : undefined}
				showCloseButton={false}
			>
				<DialogHeader className="sr-only">
					<DialogTitle>{t("rounds:products.addProduct")}</DialogTitle>
				</DialogHeader>
				<Command shouldFilter={false}>
					<CommandInput
						placeholder={t("rounds:products.searchCatalog")}
						value={q}
						onValueChange={setQ}
					/>
					<CommandList className="max-h-[60dvh] min-h-[250px]">
						{onCreateNew && (
							<CommandItem
								value="__create_new__"
								onSelect={() => {
									onCreateNew(q.trim());
									onOpenChange(false);
									setQ("");
								}}
								className="flex items-center gap-2 px-4 py-3 cursor-pointer text-brand font-medium data-[selected=true]:bg-muted"
							>
								<PlusCircle size={18} className="shrink-0" />
								{q.trim()
									? t("rounds:products.createProductQuery", {
											name: q.trim(),
										})
									: t("rounds:products.createProduct")}
							</CommandItem>
						)}
						{isFetching && (
							<div className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground">
								<Loader2 size={14} className="animate-spin shrink-0" />
								{t("rounds:products.searching")}
							</div>
						)}
						{!isFetching && (
							<CommandEmpty>{t("products:list.empty")}</CommandEmpty>
						)}
						{isFetching
							? Array.from({ length: 3 }).map((_, i) => (
									<div
										key={`skeleton-${i}`}
										className="flex items-center gap-3 px-4 py-3"
									>
										<Skeleton className="h-10 w-10 rounded-md shrink-0" />
										<div className="flex-1 space-y-1.5">
											<Skeleton className="h-4 w-3/4" />
											<Skeleton className="h-3 w-1/2" />
										</div>
									</div>
								))
							: available.map((product) => (
									<CommandItem
										key={product.id}
										value={product.id}
										onSelect={() => handleSelect(product)}
										className="flex items-center gap-3 px-4 py-3 cursor-pointer data-[selected=true]:bg-muted data-[selected=true]:text-foreground"
									>
										<ProductPickerRow
											name={product.name}
											brand={product.brand}
											sourceCountry={product.sourceCountry}
											thumbUrl={product.thumbUrl}
											priceThb={
												product.lastSellPriceThb ?? product.defaultPriceThb
											}
										/>
									</CommandItem>
								))}
					</CommandList>
				</Command>
			</DialogContent>
		</Dialog>
	);
}
