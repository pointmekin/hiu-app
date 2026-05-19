import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import {
	createRootRouteWithContext,
	HeadContent,
	Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { eq } from "drizzle-orm";
import type { ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import { db } from "#/db/index";
import { userRoles } from "#/db/schema";
import TanstackQueryProvider from "#/integrations/tanstack-query/root-provider";
import { auth } from "#/lib/auth";
import i18n from "#/lib/i18n";
import appCss from "#/styles.css?url";

interface SessionWithRole {
	user: { id: string; name: string; email: string };
	role: string;
}

interface RouterContext {
	queryClient: QueryClient;
}

const getSession = createServerFn({ method: "GET" }).handler(async () => {
	const request = getRequest();
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session) return null;
	const [roleRow] = await db
		.select({ role: userRoles.role })
		.from(userRoles)
		.where(eq(userRoles.userId, session.user.id))
		.limit(1);
	return {
		user: session.user,
		role: roleRow?.role ?? "operator",
	} as SessionWithRole;
});

export const Route = createRootRouteWithContext<RouterContext>()({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ name: "theme-color", content: "#f6f1e9" },
			{
				name: "theme-color",
				content: "#1a140e",
				media: "(prefers-color-scheme: dark)",
			},
			{ name: "apple-mobile-web-app-capable", content: "yes" },
			{ title: "OopsFoundThis" },
		],
		links: [
			{ rel: "stylesheet", href: appCss },
			{ rel: "manifest", href: "/manifest.json" },
			{ rel: "icon", href: "/favicon.ico" },
			{ rel: "apple-touch-icon", href: "/logo.svg" },
		],
	}),
	beforeLoad: async () => {
		const session = await getSession();
		return { session };
	},
	shellComponent: RootDocument,
});

const DARK_MODE_SCRIPT = `(function(){var t=localStorage.getItem('theme');var d=t==='dark'||(t===null&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark')})()`;

function RootDocument({ children }: { children: ReactNode }) {
	return (
		<html lang="th" suppressHydrationWarning>
			<head>
				{/* biome-ignore lint/security/noDangerouslySetInnerHtml: prevents dark mode flash on initial load */}
				<script dangerouslySetInnerHTML={{ __html: DARK_MODE_SCRIPT }} />
				<HeadContent />
			</head>
			<body>
				<TanstackQueryProvider>
					<I18nextProvider i18n={i18n}>{children}</I18nextProvider>
				</TanstackQueryProvider>
				<Scripts />
				<TanStackDevtools
					plugins={[
						{
							name: "TanStack Query",
							render: <ReactQueryDevtoolsPanel />,
						},
						{
							name: "TanStack Router",
							render: <TanStackRouterDevtoolsPanel />,
						},
					]}
				/>
			</body>
		</html>
	);
}
