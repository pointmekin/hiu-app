import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
	if (typeof window === "undefined") {
		return new QueryClient({
			defaultOptions: { queries: { staleTime: 60_000 } },
		});
	}
	if (!browserQueryClient) {
		browserQueryClient = new QueryClient({
			defaultOptions: { queries: { staleTime: 60_000 } },
		});
	}
	return browserQueryClient;
}

export function getContext() {
	const queryClient = getQueryClient();
	return { queryClient };
}

export default function TanstackQueryProvider({
	children,
}: {
	children: ReactNode;
}) {
	const queryClient = getQueryClient();
	return (
		<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	);
}
