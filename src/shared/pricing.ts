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
