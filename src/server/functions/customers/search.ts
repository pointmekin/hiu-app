import { createServerFn } from "@tanstack/react-start";
import { sql } from "drizzle-orm";
import { db } from "#/db/index";
import { requireSession } from "#/server/middleware";
import { searchCustomersSchema } from "#/shared/schemas/customer";

export const searchCustomers = createServerFn({ method: "GET" })
	.inputValidator(searchCustomersSchema)
	.handler(async ({ data }) => {
		await requireSession();
		const { query, limit } = data;

		if (!query.trim()) {
			const rows = await db.execute(sql`
				select id, display_name, phone, line_id, last_ordered_at
				from customers
				order by last_ordered_at desc nulls last
				limit ${limit}
			`);
			return rows.rows as Array<{
				id: string;
				display_name: string;
				phone: string | null;
				line_id: string | null;
				last_ordered_at: string | null;
			}>;
		}

		const queryWrap = `%${query}%`;
		const rows = await db.execute(sql`
			select id, display_name, phone, line_id, last_ordered_at
			from customers
			where display_name ilike ${queryWrap}
			   or phone ilike ${queryWrap}
			   or line_id ilike ${queryWrap}
			   or display_name % ${query}
			   or coalesce(phone, '') % ${query}
			   or coalesce(line_id, '') % ${query}
			order by greatest(
			           similarity(display_name, ${query}),
			           similarity(coalesce(phone, ''), ${query}),
			           similarity(coalesce(line_id, ''), ${query})
			         ) desc,
			         last_ordered_at desc nulls last
			limit ${limit}
		`);

		return rows.rows as Array<{
			id: string;
			display_name: string;
			phone: string | null;
			line_id: string | null;
			last_ordered_at: string | null;
		}>;
	});
