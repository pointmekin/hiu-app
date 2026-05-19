import { getRequest } from "@tanstack/react-start/server";
import { eq } from "drizzle-orm";
import { db } from "#/db/index";
import { userRoles } from "#/db/schema";
import { auth } from "#/lib/auth";

type SessionData = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

export async function requireSession(): Promise<SessionData> {
	const request = getRequest();
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session) {
		throw new Error("Unauthorized");
	}
	return session;
}

export async function requireAdmin(): Promise<SessionData> {
	const session = await requireSession();
	const [row] = await db
		.select({ role: userRoles.role })
		.from(userRoles)
		.where(eq(userRoles.userId, session.user.id))
		.limit(1);
	if (!row || row.role !== "admin") {
		throw new Error("Forbidden");
	}
	return session;
}
