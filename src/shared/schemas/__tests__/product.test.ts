import { describe, expect, it } from "vitest";
import { upsertProductSchema } from "#/shared/schemas/product";

describe("upsertProductSchema", () => {
	it("accepts create input (no id)", () => {
		const result = upsertProductSchema.parse({ name: "Dior Sauvage EDP" });
		expect(result.name).toBe("Dior Sauvage EDP");
		expect(result.id).toBeUndefined();
	});

	it("accepts update input (with id)", () => {
		const result = upsertProductSchema.parse({
			id: "00000000-0000-0000-0000-000000000001",
			name: "Updated name",
			brand: "Dior",
		});
		expect(result.id).toBe("00000000-0000-0000-0000-000000000001");
		expect(result.brand).toBe("Dior");
	});

	it("rejects missing name", () => {
		expect(() => upsertProductSchema.parse({ brand: "Dior" })).toThrow();
	});

	it("rejects empty name", () => {
		expect(() => upsertProductSchema.parse({ name: "" })).toThrow();
	});

	it("accepts optional fields as undefined", () => {
		const result = upsertProductSchema.parse({ name: "Test" });
		expect(result.brand).toBeUndefined();
		expect(result.category).toBeUndefined();
		expect(result.sourceCountry).toBeUndefined();
	});
});
