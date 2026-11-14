import { describe, expect, it } from "vitest";
import { computeSellPriceThb, resolveCarryOverPrice } from "#/shared/pricing";

describe("computeSellPriceThb", () => {
	it("applies FX rate and per-item fee in foreign mode", () => {
		// 1000 JPY × 0.25 + 50 THB fee
		expect(computeSellPriceThb(1000, "foreign", 0.25, 50)).toBe(300);
	});

	it("returns the entered price as-is in THB mode (no fee added)", () => {
		expect(computeSellPriceThb(1500, "thb", 0.25, 50)).toBe(1500);
	});

	it("ignores fx rate and fee entirely in THB mode", () => {
		expect(computeSellPriceThb(1500, "thb", 99, 999)).toBe(1500);
	});

	it("handles a zero per-item fee in foreign mode", () => {
		expect(computeSellPriceThb(200, "foreign", 0.3, 0)).toBe(60);
	});
});

describe("resolveCarryOverPrice", () => {
	const round = { sourceCurrency: "JPY", fxRate: 0.25, perItemFee: 50 };
	const noHistory = {
		defaultPriceThb: null,
		lastForeignPrice: null,
		lastSellPriceThb: null,
		lastSourceCurrency: null,
	};

	it("uses the catalog default price as an override when set", () => {
		expect(
			resolveCarryOverPrice(
				{
					...noHistory,
					defaultPriceThb: 990,
					lastForeignPrice: 1000,
					lastSourceCurrency: "JPY",
				},
				round,
			),
		).toEqual({ foreignPrice: 0, sellPriceThb: 990, priceOverridden: true });
	});

	it("recomputes the last foreign price with this round's FX when the currency matches", () => {
		expect(
			resolveCarryOverPrice(
				{
					...noHistory,
					lastForeignPrice: 1000,
					lastSellPriceThb: 280,
					lastSourceCurrency: "JPY",
				},
				round,
			),
		).toEqual({
			foreignPrice: 1000,
			sellPriceThb: 300,
			priceOverridden: false,
		});
	});

	it("keeps the last THB sell price as an override when the currency differs", () => {
		expect(
			resolveCarryOverPrice(
				{
					...noHistory,
					lastForeignPrice: 20000,
					lastSellPriceThb: 520,
					lastSourceCurrency: "KRW",
				},
				round,
			),
		).toEqual({ foreignPrice: 0, sellPriceThb: 520, priceOverridden: true });
	});

	it("keeps the last THB sell price when the last round had no foreign price", () => {
		expect(
			resolveCarryOverPrice(
				{
					...noHistory,
					lastForeignPrice: 0,
					lastSellPriceThb: 450,
					lastSourceCurrency: "JPY",
				},
				round,
			),
		).toEqual({ foreignPrice: 0, sellPriceThb: 450, priceOverridden: true });
	});

	it("falls back to zero when the product has no price history", () => {
		expect(resolveCarryOverPrice(noHistory, round)).toEqual({
			foreignPrice: 0,
			sellPriceThb: 0,
			priceOverridden: false,
		});
	});
});
