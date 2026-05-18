import { describe, expect, it } from "vitest";
import {
	roundProductRowSchema,
	upsertRoundProductsSchema,
} from "#/shared/schemas/round-product";

const PRODUCT_ID = "00000000-0000-4000-8000-000000000001";
const ROUND_ID = "00000000-0000-4000-8000-000000000002";

describe("roundProductRowSchema", () => {
	it("accepts valid row", () => {
		const result = roundProductRowSchema.parse({
			productId: PRODUCT_ID,
			foreignPrice: 2800,
			sellPriceThb: 658,
			priceOverridden: false,
		});
		expect(result.foreignPrice).toBe(2800);
		expect(result.priceOverridden).toBe(false);
	});

	it("accepts zero foreignPrice (unpriced placeholder)", () => {
		const result = roundProductRowSchema.parse({
			productId: PRODUCT_ID,
			foreignPrice: 0,
			sellPriceThb: 0,
		});
		expect(result.foreignPrice).toBe(0);
	});

	it("rejects negative foreignPrice", () => {
		expect(() =>
			roundProductRowSchema.parse({
				productId: PRODUCT_ID,
				foreignPrice: -1,
				sellPriceThb: 658,
			}),
		).toThrow();
	});

	it("coerces string prices to numbers", () => {
		const result = roundProductRowSchema.parse({
			productId: PRODUCT_ID,
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
				roundId: ROUND_ID,
				rows: [],
			}),
		).toThrow();
	});

	it("accepts valid input", () => {
		const result = upsertRoundProductsSchema.parse({
			roundId: ROUND_ID,
			rows: [
				{
					productId: PRODUCT_ID,
					foreignPrice: 2800,
					sellPriceThb: 658,
				},
			],
		});
		expect(result.rows).toHaveLength(1);
	});
});
