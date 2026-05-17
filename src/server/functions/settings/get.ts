import { createServerFn } from "@tanstack/react-start";
import { db } from "#/db/index";
import { appSettings } from "#/db/schema";
import { requireSession } from "#/server/middleware";
import type { AppSettings } from "#/shared/schemas/settings";

const DEFAULTS: AppSettings = {
	shippingFeePresets: [39, 50, 80],
	defaultShippingFee: 50,
	sourceCurrencies: ["JPY", "USD", "GBP", "HKD", "AUD"],
	defaultLocale: "th",
};

const SETTING_KEYS: Array<keyof AppSettings> = [
	"shippingFeePresets",
	"defaultShippingFee",
	"sourceCurrencies",
	"defaultLocale",
];

export const getSettings = createServerFn({ method: "GET" }).handler(
	async () => {
		await requireSession();

		const rows = await db.select().from(appSettings);
		const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

		return SETTING_KEYS.reduce<AppSettings>((acc, key) => {
			return {
				...acc,
				[key]: key in map ? map[key] : DEFAULTS[key],
			};
		}, {} as AppSettings);
	},
);
