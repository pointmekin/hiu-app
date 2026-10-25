import { describe, expect, it } from "vitest";
import { toCumulativeCashFlow } from "../round-stats";

describe("toCumulativeCashFlow", () => {
	it("returns an empty array when there are no rows", () => {
		expect(toCumulativeCashFlow([])).toEqual([]);
	});

	it("accumulates expected and collected amounts per day", () => {
		const result = toCumulativeCashFlow([
			{ day: "2026-05-01", expected: "1000.00", collected: "0" },
			{ day: "2026-05-02", expected: "500.00", collected: "800.00" },
			{ day: "2026-05-03", expected: "0", collected: "-100.00" },
		]);

		expect(result).toEqual([
			{ date: "2026-05-01", expected: 1000, collected: 0 },
			{ date: "2026-05-02", expected: 1500, collected: 800 },
			{ date: "2026-05-03", expected: 1500, collected: 700 },
		]);
	});
});
