import { createServerFn } from "@tanstack/react-start";
import { sql } from "drizzle-orm";
import { db } from "#/db/index";
import { requireSession } from "#/server/middleware";

export interface CrossRoundStats {
	recentRounds: Array<{
		roundId: string;
		name: string;
		country: string;
		revenue: string;
		margin: string;
		orderCount: number;
	}>;
	repeatCustomerRate: number;
	topAllTimeCustomers: Array<{
		name: string;
		totalSpend: string;
		orderCount: number;
	}>;
	countryBreakdown: Array<{ country: string; roundCount: number }>;
}

interface RecentRoundRow {
	round_id: string;
	name: string;
	country: string;
	revenue: string;
	total_cost: string;
	order_count: string;
}

interface RepeatRow {
	repeat_count: string;
	total_customers: string;
}

interface TopCustomerRow {
	display_name: string;
	total_spend: string;
	order_count: string;
}

interface CountryRow {
	country: string;
	round_count: string;
}

export const getCrossRoundStats = createServerFn({ method: "GET" }).handler(
	async () => {
		await requireSession();

		const recentRounds = (
			await db.execute(sql`
				select
					r.id::text as round_id,
					r.name,
					r.country,
					coalesce(sum(o.total_thb), 0)::text as revenue,
					coalesce(sum(
						oi.quantity * rp.foreign_price * r.fx_rate
					), 0)::text as total_cost,
					coalesce(count(o.id), 0)::text as order_count
				from rounds r
				left join orders o on o.round_id = r.id and o.status = 'active'
				left join order_items oi on oi.order_id = o.id
				left join round_products rp on rp.id = oi.round_product_id
				where r.status != 'draft'
				group by r.id
				order by r.created_at desc
				limit 6
			`)
		).rows as unknown as RecentRoundRow[];

		const [repeat] = (
			await db.execute(sql`
				select
					count(*) filter (where round_count > 1)::text as repeat_count,
					count(*)::text as total_customers
				from (
					select customer_id, count(distinct round_id) as round_count
					from orders
					where status = 'active'
					group by customer_id
				) sub
			`)
		).rows as unknown as RepeatRow[];

		const totalCustomers = Number(repeat?.total_customers ?? 0);
		const repeatCount = Number(repeat?.repeat_count ?? 0);
		const repeatCustomerRate =
			totalCustomers > 0
				? Math.round((repeatCount / totalCustomers) * 1000) / 10
				: 0;

		const topCustomers = (
			await db.execute(sql`
				select
					c.display_name,
					sum(o.total_thb)::text as total_spend,
					count(*)::text as order_count
				from orders o
				inner join customers c on c.id = o.customer_id
				where o.status = 'active'
				group by c.display_name
				order by sum(o.total_thb) desc
				limit 10
			`)
		).rows as unknown as TopCustomerRow[];

		const countryBreakdown = (
			await db.execute(sql`
				select country, count(*)::text as round_count
				from rounds
				group by country
				order by count(*) desc
			`)
		).rows as unknown as CountryRow[];

		return {
			recentRounds: recentRounds.map((r) => ({
				roundId: r.round_id,
				name: r.name,
				country: r.country,
				revenue: r.revenue,
				margin: (Number(r.revenue) - Number(r.total_cost)).toFixed(2),
				orderCount: Number(r.order_count),
			})),
			repeatCustomerRate,
			topAllTimeCustomers: topCustomers.map((r) => ({
				name: r.display_name,
				totalSpend: r.total_spend,
				orderCount: Number(r.order_count),
			})),
			countryBreakdown: countryBreakdown.map((r) => ({
				country: r.country,
				roundCount: Number(r.round_count),
			})),
		} satisfies CrossRoundStats;
	},
);
