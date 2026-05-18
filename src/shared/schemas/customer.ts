import { z } from "zod";

export const upsertAddressSchema = z.object({
	id: z.string().uuid().optional(),
	recipientName: z.string().min(1),
	mobile: z.string().min(1),
	address: z.string().min(1),
	postalCode: z.string().min(1),
	isDefault: z.boolean().default(true),
});

export type UpsertAddressInput = z.infer<typeof upsertAddressSchema>;

export const upsertCustomerSchema = z.object({
	id: z.string().uuid().optional(),
	displayName: z.string().min(1),
	lineId: z.string().optional(),
	instagramHandle: z.string().optional(),
	phone: z.string().optional(),
	notes: z.string().optional(),
	address: upsertAddressSchema.optional(),
});

export type UpsertCustomerInput = z.infer<typeof upsertCustomerSchema>;

export const searchCustomersSchema = z.object({
	query: z.string(),
	limit: z.number().int().positive().max(20).default(8),
});

export type SearchCustomersInput = z.infer<typeof searchCustomersSchema>;
