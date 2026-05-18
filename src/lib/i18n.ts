import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import enAuth from "#/locales/en/auth.json";
import enCommon from "#/locales/en/common.json";
import enCustomers from "#/locales/en/customers.json";
import enErrors from "#/locales/en/errors.json";
import enOrders from "#/locales/en/orders.json";
import enPayments from "#/locales/en/payments.json";
import enProducts from "#/locales/en/products.json";
import enRounds from "#/locales/en/rounds.json";
import enSettings from "#/locales/en/settings.json";
import thAuth from "#/locales/th/auth.json";
import thCommon from "#/locales/th/common.json";
import thCustomers from "#/locales/th/customers.json";
import thErrors from "#/locales/th/errors.json";
import thOrders from "#/locales/th/orders.json";
import thPayments from "#/locales/th/payments.json";
import thProducts from "#/locales/th/products.json";
import thRounds from "#/locales/th/rounds.json";
import thSettings from "#/locales/th/settings.json";

const resources = {
	th: {
		common: thCommon,
		auth: thAuth,
		rounds: thRounds,
		products: thProducts,
		customers: thCustomers,
		orders: thOrders,
		payments: thPayments,
		settings: thSettings,
		errors: thErrors,
	},
	en: {
		common: enCommon,
		auth: enAuth,
		rounds: enRounds,
		products: enProducts,
		customers: enCustomers,
		orders: enOrders,
		payments: enPayments,
		settings: enSettings,
		errors: enErrors,
	},
};

if (!i18n.isInitialized) {
	i18n
		.use(LanguageDetector)
		.use(initReactI18next)
		.init({
			resources,
			fallbackLng: "th",
			defaultNS: "common",
			ns: ["common", "auth", "rounds", "products", "customers", "orders", "payments", "settings", "errors"],
			detection: {
				order: ["querystring", "cookie", "navigator"],
				lookupQuerystring: "lang",
				lookupCookie: "locale",
				caches: ["cookie"],
				cookieOptions: { sameSite: "lax" },
			},
			interpolation: { escapeValue: false },
			react: { useSuspense: false },
		});
}

export default i18n;
export const SUPPORTED_LOCALES = ["th", "en"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
