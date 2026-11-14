import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ProductPickerRow } from "#/components/product-picker-row";
import { CommandGroup, CommandItem } from "#/components/ui/command";
import { useDebounce } from "#/lib/use-debounce";
import { listProductSuggestions } from "#/server/functions/products/list-suggestions";
import { addProductFromCatalog } from "#/server/functions/round-products/add-from-catalog";

export type AddedRoundProduct = Awaited<
	ReturnType<typeof addProductFromCatalog>
>;

const SUGGESTION_LIMIT = 10;

interface PreviousRoundProductsGroupProps {
	roundId: string;
	query: string;
	enabled: boolean;
	onAdded: (roundProduct: AddedRoundProduct) => void;
}

export function PreviousRoundProductsGroup({
	roundId,
	query,
	enabled,
	onAdded,
}: PreviousRoundProductsGroupProps) {
	const { t } = useTranslation("orders");
	const queryClient = useQueryClient();
	const debouncedQuery = useDebounce(query.trim(), 250);

	const { data, isFetching } = useQuery({
		queryKey: ["product-suggestions", roundId, debouncedQuery],
		queryFn: () =>
			listProductSuggestions({
				data: {
					roundId,
					q: debouncedQuery,
					limit: SUGGESTION_LIMIT,
				},
			}),
		enabled,
	});

	const mutation = useMutation({
		mutationFn: (productId: string) =>
			addProductFromCatalog({ data: { roundId, productId } }),
		onSuccess: (roundProduct) => {
			queryClient.invalidateQueries({ queryKey: ["round-products", roundId] });
			queryClient.invalidateQueries({
				queryKey: ["product-suggestions", roundId],
			});
			onAdded(roundProduct);
		},
	});

	const suggestions = data ?? [];

	if (suggestions.length === 0 && !mutation.error) return null;

	return (
		<CommandGroup
			heading={
				<span className="flex items-center gap-1.5">
					{t("form.previousRounds")}
					{(isFetching || mutation.isPending) && (
						<Loader2 size={12} className="animate-spin" />
					)}
				</span>
			}
		>
			{mutation.error && (
				<p className="px-2 py-1.5 text-xs text-destructive">
					{(mutation.error as Error).message}
				</p>
			)}
			{suggestions.map((product) => (
				<CommandItem
					key={product.id}
					value={`catalog-${product.id}`}
					disabled={mutation.isPending}
					onSelect={() => mutation.mutate(product.id)}
					className="py-2"
				>
					<ProductPickerRow
						name={product.name}
						brand={product.brand}
						sourceCountry={product.sourceCountry}
						thumbUrl={product.thumbUrl}
						priceThb={product.lastSellPriceThb ?? product.defaultPriceThb}
					/>
				</CommandItem>
			))}
		</CommandGroup>
	);
}
