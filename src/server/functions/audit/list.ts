import { createServerFn } from "@tanstack/react-start";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db/index";
import { requireAdmin } from "#/server/middleware";

export interface AuditLogEntry {
	id: number;
	userName: string | null;
	entity: string;
	entityId: string;
	action: string;
	diff: string | null;
	at: string;
}

interface AuditRow {
	id: number;
	user_name: string | null;
	entity: string;
	entity_id: string;
	action: string;
	diff: Record<string, unknown> | null;
	at: Date;
}

export const listAuditLog = createServerFn({ method: "GET" })
	.inputValidator(
		z.object({
			entity: z.string().optional(),
			limit: z.coerce.number().min(1).max(100).default(50),
			cursor: z.coerce.number().optional(),
		}),
	)
	.handler(async ({ data }) => {
		await requireAdmin();

		const cursorCondition = data.cursor
			? sql`and al.id < ${data.cursor}`
			: sql``;
		const entityCondition = data.entity
			? sql`and al.entity = ${data.entity}`
			: sql``;

		const rows = (
			await db.execute(sql`
				select
					al.id,
					u.name as user_name,
					al.entity,
					al.entity_id,
					al.action,
					al.diff,
					al.at
				from audit_log al
				left join "user" u on u.id = al.user_id
				where true
					${cursorCondition}
					${entityCondition}
				order by al.id desc
				limit ${data.limit}
			`)
		).rows as unknown as AuditRow[];

		return rows.map(
			(r): AuditLogEntry => ({
				id: r.id,
				userName: r.user_name,
				entity: r.entity,
				entityId: r.entity_id,
				action: r.action,
				diff: r.diff ? JSON.stringify(r.diff) : null,
				at: r.at.toISOString(),
			}),
		);
	});
