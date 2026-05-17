import { getRequest } from "@tanstack/react-start/server";
import { auth } from "#/lib/auth";

type SessionData = NonNullable<
	Awaited<ReturnType<typeof auth.api.getSession>>
>;

export async function requireSession(): Promise<SessionData> {
	const request = getRequest();
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session) {
		throw new Error("Unauthorized");
	}
	return session;
}
