import { createServerFn } from "@tanstack/react-start";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db/index";
import { requireSession } from "#/server/middleware";

const PAGE_SIZE = 20;

interface CustomerListRow {
	id: string;
	display_name: string;
	phone: string | null;
	line_id: string | null;
	instagram_handle: string | null;
	last_ordered_at: string | null;
	order_count: string | number;
}

function mapRow(r: CustomerListRow) {
	return {
		id: r.id,
		displayName: r.display_name,
		phone: r.phone,
		lineId: r.line_id,
		instagramHandle: r.instagram_handle,
		lastOrderedAt: r.last_ordered_at,
		orderCount: Number(r.order_count),
	};
}

const cursorSchema = z.object({
	lastOrderedAt: z.string().nullable(),
	id: z.string().uuid(),
});

export type CustomerListCursor = z.infer<typeof cursorSchema>;

export const listCustomers = createServerFn({ method: "GET" })
	.inputValidator(
		z.object({
			q: z.string().optional(),
			limit: z.coerce.number().default(PAGE_SIZE),
			cursor: cursorSchema.optional(),
		}),
	)
	.handler(async ({ data }) => {
		await requireSession();
		const limit = data.limit;

		// Search path — return all matches without cursor pagination
		if (data.q?.trim()) {
			const q = data.q.trim();
			const queryWrap = `%${q}%`;
			const rows = await db.execute(sql`
				select
					c.id, c.display_name, c.phone, c.line_id, c.instagram_handle, c.last_ordered_at,
					coalesce(oc.order_count, 0) as order_count
				from customers c
				left join (
					select customer_id, count(*)::int as order_count
					from orders where status = 'active'
					group by customer_id
				) oc on oc.customer_id = c.id
				where c.display_name ilike ${queryWrap}
				   or c.phone ilike ${queryWrap}
				   or c.line_id ilike ${queryWrap}
				   or c.display_name % ${q}
				   or coalesce(c.phone, '') % ${q}
				   or coalesce(c.line_id, '') % ${q}
				order by greatest(
				           similarity(c.display_name, ${q}),
				           similarity(coalesce(c.phone, ''), ${q}),
				           similarity(coalesce(c.line_id, ''), ${q})
				         ) desc,
				         c.last_ordered_at desc nulls last
				limit ${limit}
			`);
			return {
				items: (rows.rows as unknown as CustomerListRow[]).map(mapRow),
				nextCursor: null,
			};
		}

		// Browse path — keyset cursor pagination
		const fetchLimit = limit + 1;
		let rows: Awaited<ReturnType<typeof db.execute>>;

		if (!data.cursor) {
			rows = await db.execute(sql`
				select
					c.id, c.display_name, c.phone, c.line_id, c.instagram_handle, c.last_ordered_at,
					coalesce(oc.order_count, 0) as order_count
				from customers c
				left join (
					select customer_id, count(*)::int as order_count
					from orders where status = 'active'
					group by customer_id
				) oc on oc.customer_id = c.id
				order by c.last_ordered_at desc nulls last, c.id
				limit ${fetchLimit}
			`);
		} else if (data.cursor.lastOrderedAt !== null) {
			const cursorTs = data.cursor.lastOrderedAt;
			const cursorId = data.cursor.id;
			rows = await db.execute(sql`
				select
					c.id, c.display_name, c.phone, c.line_id, c.instagram_handle, c.last_ordered_at,
					coalesce(oc.order_count, 0) as order_count
				from customers c
				left join (
					select customer_id, count(*)::int as order_count
					from orders where status = 'active'
					group by customer_id
				) oc on oc.customer_id = c.id
				where c.last_ordered_at < ${cursorTs}::timestamptz
				   or (c.last_ordered_at = ${cursorTs}::timestamptz and c.id > ${cursorId})
				   or c.last_ordered_at is null
				order by c.last_ordered_at desc nulls last, c.id
				limit ${fetchLimit}
			`);
		} else {
			const cursorId = data.cursor.id;
			rows = await db.execute(sql`
				select
					c.id, c.display_name, c.phone, c.line_id, c.instagram_handle, c.last_ordered_at,
					coalesce(oc.order_count, 0) as order_count
				from customers c
				left join (
					select customer_id, count(*)::int as order_count
					from orders where status = 'active'
					group by customer_id
				) oc on oc.customer_id = c.id
				where c.last_ordered_at is null and c.id > ${cursorId}
				order by c.last_ordered_at desc nulls last, c.id
				limit ${fetchLimit}
			`);
		}

		const all = rows.rows as unknown as CustomerListRow[];
		const hasMore = all.length > limit;
		const page = hasMore ? all.slice(0, limit) : all;
		const items = page.map(mapRow);
		const last = page[page.length - 1];

		return {
			items,
			nextCursor:
				hasMore && last
					? { lastOrderedAt: last.last_ordered_at ?? null, id: last.id }
					: null,
		};
	});
