import { describe, expect, it } from "vitest";
import { getEffectivePaymentStatus } from "#/shared/payment-status";

describe("getEffectivePaymentStatus", () => {
	it("marks a stale partial status as paid when the balance is zero", () => {
		expect(getEffectivePaymentStatus("partial", 2000, 2000)).toBe("paid");
	});

	it("keeps an order partial while a balance remains", () => {
		expect(getEffectivePaymentStatus("partial", 1060, 2000)).toBe("partial");
	});

	it("downgrades a stale paid status when the balance returns", () => {
		expect(getEffectivePaymentStatus("paid", 1060, 2000)).toBe("partial");
	});

	it("marks an unpaid order as pending", () => {
		expect(getEffectivePaymentStatus("pending", 0, 2000)).toBe("pending");
	});

	it("preserves refunded status", () => {
		expect(getEffectivePaymentStatus("refunded", 0, 2000)).toBe("refunded");
	});
});
