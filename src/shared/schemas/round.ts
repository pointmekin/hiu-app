import { z } from "zod";

export const SOURCE_CURRENCIES = [
	"JPY",
	"USD",
	"GBP",
	"HKD",
	"AUD",
] as const;
export type SourceCurrency = (typeof SOURCE_CURRENCIES)[number];

export const ROUND_STATUSES = [
	"draft",
	"open",
	"closed",
	"shipping",
	"done",
	"archived",
] as const;
export type RoundStatus = (typeof ROUND_STATUSES)[number];

export const createRoundSchema = z.object({
	name: z.string().min(1),
	country: z.string().min(1),
	storeHint: z.string().optional(),
	purchaseStart: z.string().optional(),
	purchaseEnd: z.string().optional(),
	deliveryEta: z.string().optional(),
	status: z.enum(ROUND_STATUSES).default("draft"),
	sourceCurrency: z.enum(SOURCE_CURRENCIES),
	fxRate: z.coerce.number().positive(),
	perItemFeeTh: z.coerce.number().min(0).default(0),
	defaultShippingFee: z.coerce.number().min(0).default(50),
	notes: z.string().optional(),
});

export type CreateRoundInput = z.infer<typeof createRoundSchema>;

export const updateRoundSchema = createRoundSchema.partial().extend({
	id: z.string().uuid(),
});

export type UpdateRoundInput = z.infer<typeof updateRoundSchema>;
