import { describe, expect, it } from "vitest";
import { computeSellPriceThb } from "#/shared/pricing";

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
