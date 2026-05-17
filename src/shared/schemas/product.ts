import { z } from "zod";

export const upsertProductSchema = z.object({
	id: z.string().uuid().optional(),
	name: z.string().min(1),
	brand: z.string().optional(),
	sourceCountry: z.string().optional(),
	category: z.string().optional(),
});

export type UpsertProductInput = z.infer<typeof upsertProductSchema>;

export const productSearchSchema = z.object({
	q: z.string(),
	limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type ProductSearchInput = z.infer<typeof productSearchSchema>;
