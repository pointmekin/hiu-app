import { createServerFn } from "@tanstack/react-start";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db/index";
import { requireSession } from "#/server/middleware";

export interface RoundStats {
	totalOrders: number;
	totalRevenue: string;
	totalCost: string;
	grossMargin: string;
	outstandingBalance: string;
	paidCount: number;
	totalActiveOrders: number;
	paymentFunnel: {
		pending: { count: number; amount: string };
		partial: { count: number; amount: string };
		paid: { count: number; amount: string };
	};
	topProducts: Array<{
		name: string;
		brand: string | null;
		qty: number;
		revenue: string;
	}>;
	topCustomers: Array<{
		name: string;
		totalSpend: string;
		orderCount: number;
	}>;
	dailyOrders: Array<{ date: string; count: number; revenue: string }>;
}

interface KpiRow {
	total_orders: string;
	total_revenue: string;
	total_cost: string;
	outstanding_balance: string;
	paid_count: string;
	total_active: string;
}

interface FunnelRow {
	payment_status: string;
	cnt: string;
	total_remaining: string;
}

interface ProductRow {
	name: string;
	brand: string | null;
	total_qty: string;
	total_revenue: string;
}

interface CustomerRow {
	display_name: string;
	total_spend: string;
	order_count: string;
}

interface DailyRow {
	day: string;
	cnt: string;
	revenue: string;
}

export const getRoundStats = createServerFn({ method: "GET" })
	.inputValidator(z.object({ roundId: z.string().uuid() }))
	.handler(async ({ data }) => {
		await requireSession();

		const [kpi] = (
			await db.execute(sql`
				select
					coalesce(count(*), 0)::text as total_orders,
					coalesce(sum(o.total_thb), 0)::text as total_revenue,
					coalesce(sum(oi.foreign_cost), 0)::text as total_cost,
					coalesce(sum(o.total_thb - o.paid_amount_thb), 0)::text as outstanding_balance,
					coalesce(count(*) filter (where o.payment_status = 'paid'), 0)::text as paid_count,
					coalesce(count(*), 0)::text as total_active
				from orders o
				left join (
					select oi.order_id, sum(rp.foreign_price * r.fx_rate * oi.quantity) as foreign_cost
					from order_items oi
					inner join round_products rp on rp.id = oi.round_product_id
					inner join rounds r on r.id = rp.round_id
					group by oi.order_id
				) oi on oi.order_id = o.id
				where o.round_id = ${data.roundId} and o.status = 'active'
			`)
		).rows as unknown as KpiRow[];

		const funnelRows = (
			await db.execute(sql`
				select
					o.payment_status,
					count(*)::text as cnt,
					coalesce(sum(o.total_thb - o.paid_amount_thb), 0)::text as total_remaining
				from orders o
				where o.round_id = ${data.roundId} and o.status = 'active'
				group by o.payment_status
			`)
		).rows as unknown as FunnelRow[];

		const paymentFunnel: RoundStats["paymentFunnel"] = {
			pending: { count: 0, amount: "0" },
			partial: { count: 0, amount: "0" },
			paid: { count: 0, amount: "0" },
		};
		for (const row of funnelRows) {
			const status = row.payment_status as keyof typeof paymentFunnel;
			if (status in paymentFunnel) {
				paymentFunnel[status] = {
					count: Number(row.cnt),
					amount: row.total_remaining,
				};
			}
		}

		const topProducts = (
			await db.execute(sql`
				select
					p.name,
					p.brand,
					sum(oi.quantity)::text as total_qty,
					sum(oi.line_total_thb)::text as total_revenue
				from order_items oi
				inner join round_products rp on rp.id = oi.round_product_id
				inner join products p on p.id = rp.product_id
				inner join orders o on o.id = oi.order_id
				where rp.round_id = ${data.roundId} and o.status = 'active'
				group by p.name, p.brand
				order by sum(oi.quantity) desc
				limit 10
			`)
		).rows as unknown as ProductRow[];

		const topCustomers = (
			await db.execute(sql`
				select
					c.display_name,
					sum(o.total_thb)::text as total_spend,
					count(*)::text as order_count
				from orders o
				inner join customers c on c.id = o.customer_id
				where o.round_id = ${data.roundId} and o.status = 'active'
				group by c.display_name
				order by sum(o.total_thb) desc
				limit 10
			`)
		).rows as unknown as CustomerRow[];

		const dailyOrders = (
			await db.execute(sql`
				select
					to_char(date(o.created_at at time zone 'Asia/Bangkok'), 'YYYY-MM-DD') as day,
					count(*)::text as cnt,
					coalesce(sum(o.total_thb), 0)::text as revenue
				from orders o
				where o.round_id = ${data.roundId} and o.status = 'active'
				group by day
				order by day
			`)
		).rows as unknown as DailyRow[];

		const totalRevenue = Number(kpi?.total_revenue ?? 0);
		const totalCost = Number(kpi?.total_cost ?? 0);

		return {
			totalOrders: Number(kpi?.total_orders ?? 0),
			totalRevenue: kpi?.total_revenue ?? "0",
			totalCost: kpi?.total_cost ?? "0",
			grossMargin: (totalRevenue - totalCost).toFixed(2),
			outstandingBalance: kpi?.outstanding_balance ?? "0",
			paidCount: Number(kpi?.paid_count ?? 0),
			totalActiveOrders: Number(kpi?.total_active ?? 0),
			paymentFunnel,
			topProducts: topProducts.map((r) => ({
				name: r.name,
				brand: r.brand,
				qty: Number(r.total_qty),
				revenue: r.total_revenue,
			})),
			topCustomers: topCustomers.map((r) => ({
				name: r.display_name,
				totalSpend: r.total_spend,
				orderCount: Number(r.order_count),
			})),
			dailyOrders: dailyOrders.map((r) => ({
				date: r.day,
				count: Number(r.cnt),
				revenue: r.revenue,
			})),
		} satisfies RoundStats;
	});
