export type PriceMode = "foreign" | "thb";

/**
 * Resolve the THB sell price from an entered price.
 * - "foreign": price is in the round's source currency → apply FX + per-item fee.
 * - "thb": price is already the final THB sell price → use as-is (no fee added).
 */
export function computeSellPriceThb(
	price: number,
	mode: PriceMode,
	fxRate: number,
	perItemFee: number,
): number {
	return mode === "thb" ? price : price * fxRate + perItemFee;
}

export interface PriceHistory {
	defaultPriceThb: number | null;
	lastForeignPrice: number | null;
	lastSellPriceThb: number | null;
	lastSourceCurrency: string | null;
}

export interface RoundPricing {
	sourceCurrency: string;
	fxRate: number;
	perItemFee: number;
}

export interface CarryOverPrice {
	foreignPrice: number;
	sellPriceThb: number;
	priceOverridden: boolean;
}

/**
 * Pick the starting price when a product from an earlier round joins a new round.
 * A foreign price is only reused when the currency matches, because another
 * round's FX rate would give a wrong THB price.
 */
export function resolveCarryOverPrice(
	history: PriceHistory,
	round: RoundPricing,
): CarryOverPrice {
	if (history.defaultPriceThb != null) {
		return {
			foreignPrice: 0,
			sellPriceThb: history.defaultPriceThb,
			priceOverridden: true,
		};
	}
	const lastForeignPrice = history.lastForeignPrice ?? 0;
	if (
		lastForeignPrice > 0 &&
		history.lastSourceCurrency === round.sourceCurrency
	) {
		return {
			foreignPrice: lastForeignPrice,
			sellPriceThb: computeSellPriceThb(
				lastForeignPrice,
				"foreign",
				round.fxRate,
				round.perItemFee,
			),
			priceOverridden: false,
		};
	}
	if (history.lastSellPriceThb != null) {
		return {
			foreignPrice: 0,
			sellPriceThb: history.lastSellPriceThb,
			priceOverridden: true,
		};
	}
	return { foreignPrice: 0, sellPriceThb: 0, priceOverridden: false };
}
