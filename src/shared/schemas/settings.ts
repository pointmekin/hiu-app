import { z } from "zod";

export const settingsSchema = z.object({
	shippingFeePresets: z.array(z.number().positive()),
	defaultShippingFee: z.number().positive(),
	sourceCurrencies: z.array(z.string().min(1)),
	defaultLocale: z.enum(["th", "en"]),
});

export type AppSettings = z.infer<typeof settingsSchema>;

export const updateSettingsSchema = settingsSchema.partial();
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
