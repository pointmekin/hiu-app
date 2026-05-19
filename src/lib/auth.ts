import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { db } from "#/db/index";
import * as schema from "#/db/schema";

export const auth = betterAuth({
	baseURL: process.env.BETTER_AUTH_URL,
	secret: process.env.BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, {
		provider: "pg",
		schema: {
			user: schema.user,
			session: schema.session,
			account: schema.account,
			verification: schema.verification,
		},
	}),
	emailAndPassword: {
		enabled: true,
		autoSignIn: false,
	},
	session: {
		expiresIn: 60 * 60 * 24 * 30,
		updateAge: 60 * 60 * 24,
		cookieCache: { enabled: true, maxAge: 60 * 5 },
	},
	advanced: {
		useSecureCookies: process.env.NODE_ENV === "production",
		defaultCookieAttributes: { sameSite: "lax" },
	},
	plugins: [tanstackStartCookies()],
});

export type Auth = typeof auth;
