import { db } from "#/db/index";
import { auditLog } from "#/db/schema";

interface AuditEntry {
	userId: string;
	entity: string;
	entityId: string;
	action: string;
	diff?: unknown;
}

export async function writeAudit({
	userId,
	entity,
	entityId,
	action,
	diff,
}: AuditEntry): Promise<void> {
	await db.insert(auditLog).values({
		userId,
		entity,
		entityId,
		action,
		diff: diff ?? null,
	});
}
