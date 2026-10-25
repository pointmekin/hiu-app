import { createServerFn } from "@tanstack/react-start";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db/index";
import { requireSession } from "#/server/middleware";

interface FunnelBucket {
	count: number;
	paid: string;
	remaining: string;
}

export interface CashFlowPoint {
	date: string;
	expected: number;
	collected: number;
}

export interface RoundStats {
	totalOrders: number;
	expectedRevenue: string;
	collectedRevenue: string;
	outstandingBalance: string;
	productSubtotal: string;
	shippingFees: string;
	totalCost: string;
	grossMargin: string;
	paidCount: number;
	totalActiveOrders: number;
	packedCount: number;
	trackedCount: number;
	paymentFunnel: {
		pending: FunnelBucket;
		partial: FunnelBucket;
		paid: FunnelBucket;
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
		paid: string;
		outstanding: string;
		orderCount: number;
	}>;
	cashFlow: CashFlowPoint[];
	paymentMethods: Array<{
		method: string | null;
		amount: string;
		count: number;
	}>;
}

interface KpiRow {
	total_orders: string;
	expected_revenue: string;
	collected_revenue: string;
	product_subtotal: string;
	shipping_fees: string;
	total_cost: string;
	outstanding_balance: string;
	paid_count: string;
	packed_count: string;
	tracked_count: string;
}

interface FunnelRow {
	payment_status: string;
	cnt: string;
	total_paid: string;
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
	total_paid: string;
	total_outstanding: string;
	order_count: string;
}

export interface DailyCashRow {
	day: string;
	expected: string;
	collected: string;
}

interface MethodRow {
	method: string | null;
	amount: string;
	cnt: string;
}

export function toCumulativeCashFlow(rows: DailyCashRow[]): CashFlowPoint[] {
	let expected = 0;
	let collected = 0;
	return rows.map((r) => {
		expected += Number(r.expected);
		collected += Number(r.collected);
		return { date: r.day, expected, collected };
	});
}

export const getRoundStats = createServerFn({ method: "GET" })
	.validator(z.object({ roundId: z.string().uuid() }))
	.handler(async ({ data }) => {
		await requireSession();

		const [kpi] = (
			await db.execute(sql`
				select
					count(*)::text as total_orders,
					coalesce(sum(NULLIF(o.total_thb, 'NaN'::numeric)), 0)::text as expected_revenue,
					coalesce(sum(NULLIF(o.paid_amount_thb, 'NaN'::numeric)), 0)::text as collected_revenue,
					coalesce(sum(NULLIF(o.subtotal_thb, 'NaN'::numeric)), 0)::text as product_subtotal,
					coalesce(sum(NULLIF(o.shipping_fee_thb, 'NaN'::numeric)), 0)::text as shipping_fees,
					coalesce(sum(oi.foreign_cost), 0)::text as total_cost,
					coalesce(sum(greatest(NULLIF(o.total_thb, 'NaN'::numeric) - NULLIF(o.paid_amount_thb, 'NaN'::numeric), 0)), 0)::text as outstanding_balance,
					count(*) filter (where o.payment_status = 'paid')::text as paid_count,
					count(*) filter (where o.is_packed)::text as packed_count,
					count(*) filter (where nullif(trim(o.kerry_tracking), '') is not null)::text as tracked_count
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
					coalesce(sum(least(NULLIF(o.paid_amount_thb, 'NaN'::numeric), NULLIF(o.total_thb, 'NaN'::numeric))), 0)::text as total_paid,
					coalesce(sum(greatest(NULLIF(o.total_thb, 'NaN'::numeric) - NULLIF(o.paid_amount_thb, 'NaN'::numeric), 0)), 0)::text as total_remaining
				from orders o
				where o.round_id = ${data.roundId} and o.status = 'active'
				group by o.payment_status
			`)
		).rows as unknown as FunnelRow[];

		const emptyBucket: FunnelBucket = { count: 0, paid: "0", remaining: "0" };
		const paymentFunnel: RoundStats["paymentFunnel"] = {
			pending: emptyBucket,
			partial: emptyBucket,
			paid: emptyBucket,
		};
		for (const row of funnelRows) {
			const status = row.payment_status as keyof typeof paymentFunnel;
			if (status in paymentFunnel) {
				paymentFunnel[status] = {
					count: Number(row.cnt),
					paid: row.total_paid,
					remaining: row.total_remaining,
				};
			}
		}

		const topProducts = (
			await db.execute(sql`
				select
					p.name,
					p.brand,
					sum(oi.quantity)::text as total_qty,
					coalesce(sum(NULLIF(oi.line_total_thb, 'NaN'::numeric)), 0)::text as total_revenue
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
					coalesce(sum(NULLIF(o.total_thb, 'NaN'::numeric)), 0)::text as total_spend,
					coalesce(sum(least(NULLIF(o.paid_amount_thb, 'NaN'::numeric), NULLIF(o.total_thb, 'NaN'::numeric))), 0)::text as total_paid,
					coalesce(sum(greatest(NULLIF(o.total_thb, 'NaN'::numeric) - NULLIF(o.paid_amount_thb, 'NaN'::numeric), 0)), 0)::text as total_outstanding,
					count(*)::text as order_count
				from orders o
				inner join customers c on c.id = o.customer_id
				where o.round_id = ${data.roundId} and o.status = 'active'
				group by c.display_name
				order by sum(NULLIF(o.total_thb, 'NaN'::numeric)) desc nulls last
				limit 10
			`)
		).rows as unknown as CustomerRow[];

		const dailyCash = (
			await db.execute(sql`
				with daily as (
					select
						date(o.created_at at time zone 'Asia/Bangkok') as day,
						coalesce(NULLIF(o.total_thb, 'NaN'::numeric), 0) as expected,
						0::numeric as collected
					from orders o
					where o.round_id = ${data.roundId} and o.status = 'active'
					union all
					select
						date(p.paid_at at time zone 'Asia/Bangkok') as day,
						0::numeric as expected,
						case when p.type = 'refund' then -p.amount_thb else p.amount_thb end as collected
					from order_payments p
					inner join orders o on o.id = p.order_id
					where o.round_id = ${data.roundId} and o.status = 'active'
				)
				select
					to_char(day, 'YYYY-MM-DD') as day,
					sum(expected)::text as expected,
					sum(collected)::text as collected
				from daily
				group by day
				order by day
			`)
		).rows as unknown as DailyCashRow[];

		const paymentMethods = (
			await db.execute(sql`
				select
					p.method,
					sum(case when p.type = 'refund' then -p.amount_thb else p.amount_thb end)::text as amount,
					count(*)::text as cnt
				from order_payments p
				inner join orders o on o.id = p.order_id
				where o.round_id = ${data.roundId} and o.status = 'active'
				group by p.method
				order by sum(p.amount_thb) desc
			`)
		).rows as unknown as MethodRow[];

		const productSubtotal = Number(kpi?.product_subtotal ?? 0);
		const totalCost = Number(kpi?.total_cost ?? 0);
		const totalOrders = Number(kpi?.total_orders ?? 0);

		return {
			totalOrders,
			expectedRevenue: kpi?.expected_revenue ?? "0",
			collectedRevenue: kpi?.collected_revenue ?? "0",
			outstandingBalance: kpi?.outstanding_balance ?? "0",
			productSubtotal: kpi?.product_subtotal ?? "0",
			shippingFees: kpi?.shipping_fees ?? "0",
			totalCost: kpi?.total_cost ?? "0",
			grossMargin: (productSubtotal - totalCost).toFixed(2),
			paidCount: Number(kpi?.paid_count ?? 0),
			totalActiveOrders: totalOrders,
			packedCount: Number(kpi?.packed_count ?? 0),
			trackedCount: Number(kpi?.tracked_count ?? 0),
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
				paid: r.total_paid,
				outstanding: r.total_outstanding,
				orderCount: Number(r.order_count),
			})),
			cashFlow: toCumulativeCashFlow(dailyCash),
			paymentMethods: paymentMethods.map((r) => ({
				method: r.method,
				amount: r.amount,
				count: Number(r.cnt),
			})),
		} satisfies RoundStats;
	});
