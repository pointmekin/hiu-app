import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import enAuth from "#/locales/en/auth.json";
import enCommon from "#/locales/en/common.json";
import enErrors from "#/locales/en/errors.json";
import enRounds from "#/locales/en/rounds.json";
import thAuth from "#/locales/th/auth.json";
import thCommon from "#/locales/th/common.json";
import thErrors from "#/locales/th/errors.json";
import thRounds from "#/locales/th/rounds.json";

const resources = {
	th: {
		common: thCommon,
		auth: thAuth,
		rounds: thRounds,
		errors: thErrors,
	},
	en: {
		common: enCommon,
		auth: enAuth,
		rounds: enRounds,
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
			ns: ["common", "auth", "rounds", "errors"],
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
