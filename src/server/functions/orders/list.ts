import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "#/db/index";
import {
	customers,
	orderItems,
	orders,
	products,
	roundProducts,
} from "#/db/schema";
import { requireSession } from "#/server/middleware";
import { listOrdersSchema } from "#/shared/schemas/order";

export const listOrders = createServerFn({ method: "GET" })
	.inputValidator(listOrdersSchema)
	.handler(async ({ data }) => {
		await requireSession();

		const conditions = [eq(orders.roundId, data.roundId)];
		if (data.paymentStatus)
			conditions.push(eq(orders.paymentStatus, data.paymentStatus));
		if (data.status) conditions.push(eq(orders.status, data.status));

		const rows = await db
			.select({
				id: orders.id,
				roundId: orders.roundId,
				customerId: orders.customerId,
				addressId: orders.addressId,
				subtotalThb: orders.subtotalThb,
				shippingFeeThb: orders.shippingFeeThb,
				totalThb: orders.totalThb,
				paidAmountThb: orders.paidAmountThb,
				paymentStatus: orders.paymentStatus,
				kerryTracking: orders.kerryTracking,
				status: orders.status,
				notes: orders.notes,
				createdAt: orders.createdAt,
				customerName: customers.displayName,
				customerPhone: customers.phone,
			})
			.from(orders)
			.innerJoin(customers, eq(orders.customerId, customers.id))
			.where(and(...conditions))
			.orderBy(desc(orders.createdAt));

		if (rows.length === 0) return [];

		const orderIds = rows.map((r) => r.id);

		const itemRows = await db
			.select({
				orderId: orderItems.orderId,
				productName: products.name,
				productBrand: products.brand,
				quantity: orderItems.quantity,
			})
			.from(orderItems)
			.innerJoin(roundProducts, eq(orderItems.roundProductId, roundProducts.id))
			.innerJoin(products, eq(roundProducts.productId, products.id))
			.where(inArray(orderItems.orderId, orderIds));

		const itemsByOrderId = new Map<
			string,
			Array<{
				productName: string;
				productBrand: string | null;
				quantity: number;
			}>
		>();
		for (const item of itemRows) {
			const list = itemsByOrderId.get(item.orderId) ?? [];
			list.push({
				productName: item.productName,
				productBrand: item.productBrand,
				quantity: item.quantity,
			});
			itemsByOrderId.set(item.orderId, list);
		}

		return rows.map((order) => ({
			...order,
			items: itemsByOrderId.get(order.id) ?? [],
		}));
	});
