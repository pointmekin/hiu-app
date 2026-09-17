import type { PaymentStatus } from "#/shared/schemas/order";

export function getEffectivePaymentStatus(
	storedStatus: string,
	paidAmountThb: number,
	totalThb: number,
): PaymentStatus {
	if (storedStatus === "refunded") return "refunded";
	if (paidAmountThb <= 0) return "pending";
	if (paidAmountThb >= totalThb) return "paid";
	return "partial";
}
