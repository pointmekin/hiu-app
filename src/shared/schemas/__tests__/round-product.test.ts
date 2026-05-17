import { describe, expect, it } from "vitest";
import {
	roundProductRowSchema,
	upsertRoundProductsSchema,
} from "#/shared/schemas/round-product";

describe("roundProductRowSchema", () => {
	it("accepts valid row", () => {
		const result = roundProductRowSchema.parse({
			productId: "00000000-0000-0000-0000-000000000001",
			foreignPrice: 2800,
			sellPriceThb: 658,
			priceOverridden: false,
		});
		expect(result.foreignPrice).toBe(2800);
		expect(result.priceOverridden).toBe(false);
	});

	it("rejects non-positive foreignPrice", () => {
		expect(() =>
			roundProductRowSchema.parse({
				productId: "00000000-0000-0000-0000-000000000001",
				foreignPrice: 0,
				sellPriceThb: 658,
			}),
		).toThrow();
	});

	it("coerces string prices to numbers", () => {
		const result = roundProductRowSchema.parse({
			productId: "00000000-0000-0000-0000-000000000001",
			foreignPrice: "2800",
			sellPriceThb: "658.00",
		});
		expect(typeof result.foreignPrice).toBe("number");
		expect(result.foreignPrice).toBe(2800);
	});
});

describe("upsertRoundProductsSchema", () => {
	it("rejects empty rows array", () => {
		expect(() =>
			upsertRoundProductsSchema.parse({
				roundId: "00000000-0000-0000-0000-000000000001",
				rows: [],
			}),
		).toThrow();
	});

	it("accepts valid input", () => {
		const result = upsertRoundProductsSchema.parse({
			roundId: "00000000-0000-0000-0000-000000000001",
			rows: [
				{
					productId: "00000000-0000-0000-0000-000000000002",
					foreignPrice: 2800,
					sellPriceThb: 658,
				},
			],
		});
		expect(result.rows).toHaveLength(1);
	});
});
