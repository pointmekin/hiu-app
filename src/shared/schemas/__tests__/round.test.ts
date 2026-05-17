import { describe, expect, it } from "vitest";
import {
	createRoundSchema,
	updateRoundSchema,
} from "#/shared/schemas/round";

describe("createRoundSchema", () => {
	it("accepts valid input", () => {
		const result = createRoundSchema.parse({
			name: "Japan May 2026",
			country: "Japan",
			sourceCurrency: "JPY",
			fxRate: 0.235,
		});
		expect(result.name).toBe("Japan May 2026");
		expect(result.status).toBe("draft");
		expect(result.perItemFeeTh).toBe(0);
		expect(result.defaultShippingFee).toBe(50);
	});

	it("rejects missing required fields", () => {
		expect(() =>
			createRoundSchema.parse({ country: "Japan", sourceCurrency: "JPY", fxRate: 0.2 }),
		).toThrow();
	});

	it("rejects invalid currency", () => {
		expect(() =>
			createRoundSchema.parse({
				name: "Test",
				country: "Japan",
				sourceCurrency: "XXX",
				fxRate: 0.2,
			}),
		).toThrow();
	});

	it("rejects negative fxRate", () => {
		expect(() =>
			createRoundSchema.parse({
				name: "Test",
				country: "Japan",
				sourceCurrency: "JPY",
				fxRate: -1,
			}),
		).toThrow();
	});

	it("coerces string fxRate to number", () => {
		const result = createRoundSchema.parse({
			name: "Test",
			country: "Japan",
			sourceCurrency: "JPY",
			fxRate: "0.235",
		});
		expect(typeof result.fxRate).toBe("number");
		expect(result.fxRate).toBe(0.235);
	});
});

describe("updateRoundSchema", () => {
	it("requires id", () => {
		expect(() =>
			updateRoundSchema.parse({ name: "New name" }),
		).toThrow();
	});

	it("accepts partial update with id", () => {
		const result = updateRoundSchema.parse({
			id: "00000000-0000-0000-0000-000000000001",
			name: "Updated name",
		});
		expect(result.id).toBe("00000000-0000-0000-0000-000000000001");
		expect(result.name).toBe("Updated name");
		expect(result.country).toBeUndefined();
	});
});
