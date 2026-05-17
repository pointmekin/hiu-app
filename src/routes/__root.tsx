import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Scripts,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import type { ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import TanstackQueryProvider from "#/integrations/tanstack-query/root-provider";
import { auth } from "#/lib/auth";
import i18n from "#/lib/i18n";
import appCss from "#/styles.css?url";

interface RouterContext {
	queryClient: QueryClient;
}

const getSession = createServerFn({ method: "GET" }).handler(async () => {
	const request = getRequest();
	const session = await auth.api.getSession({ headers: request.headers });
	return session;
});

export const Route = createRootRouteWithContext<RouterContext>()({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ name: "theme-color", content: "#f6f1e9" },
			{ title: "ร้านหิ้ว" },
		],
		links: [
			{ rel: "stylesheet", href: appCss },
			{ rel: "manifest", href: "/manifest.json" },
			{ rel: "icon", href: "/favicon.ico" },
		],
	}),
	beforeLoad: async () => {
		const session = await getSession();
		return { session };
	},
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: ReactNode }) {
	return (
		<html lang="th" suppressHydrationWarning>
			<head>
				<HeadContent />
			</head>
			<body>
				<TanstackQueryProvider>
					<I18nextProvider i18n={i18n}>{children}</I18nextProvider>
				</TanstackQueryProvider>
				<Scripts />
			</body>
		</html>
	);
}
