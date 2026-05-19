import { z } from "zod";

export const PAYMENT_TYPES = [
	"deposit",
	"remainder",
	"full",
	"refund",
] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];

export const PAYMENT_METHODS = ["bank_transfer", "promptpay", "cash"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const recordPaymentSchema = z.object({
	orderId: z.string().uuid(),
	amountThb: z.number().positive(),
	type: z.enum(PAYMENT_TYPES),
	method: z.string().optional(),
	notes: z.string().optional(),
});

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
