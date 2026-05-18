import { z } from "zod";

export const roundProductRowSchema = z.object({
	productId: z.string().uuid(),
	foreignPrice: z.coerce.number().min(0),
	sellPriceThb: z.coerce.number().min(0),
	priceOverridden: z.boolean().default(false),
	storeLocation: z.string().optional(),
	notes: z.string().optional(),
});

export type RoundProductRow = z.infer<typeof roundProductRowSchema>;

export const upsertRoundProductsSchema = z.object({
	roundId: z.string().uuid(),
	rows: z.array(roundProductRowSchema).min(1),
});

export type UpsertRoundProductsInput = z.infer<typeof upsertRoundProductsSchema>;

export const recomputeFromFxSchema = z.object({
	roundId: z.string().uuid(),
});

export type RecomputeFromFxInput = z.infer<typeof recomputeFromFxSchema>;
