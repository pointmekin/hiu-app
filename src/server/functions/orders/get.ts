import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db/index";
import {
	customerAddresses,
	customers,
	orderItems,
	orderPayments,
	orders,
	products,
	roundProducts,
} from "#/db/schema";
import { requireSession } from "#/server/middleware";

export const getOrder = createServerFn({ method: "GET" })
	.inputValidator(z.object({ id: z.string().uuid() }))
	.handler(async ({ data }) => {
		await requireSession();

		const [order] = await db
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
				updatedAt: orders.updatedAt,
				customerName: customers.displayName,
				customerPhone: customers.phone,
			})
			.from(orders)
			.innerJoin(customers, eq(orders.customerId, customers.id))
			.where(eq(orders.id, data.id))
			.limit(1);

		if (!order) throw new Error("Order not found");

		const items = await db
			.select({
				id: orderItems.id,
				roundProductId: orderItems.roundProductId,
				quantity: orderItems.quantity,
				unitPriceThb: orderItems.unitPriceThb,
				lineTotalThb: orderItems.lineTotalThb,
				productName: products.name,
				productBrand: products.brand,
			})
			.from(orderItems)
			.innerJoin(roundProducts, eq(orderItems.roundProductId, roundProducts.id))
			.innerJoin(products, eq(roundProducts.productId, products.id))
			.where(eq(orderItems.orderId, data.id));

		const payments = await db
			.select()
			.from(orderPayments)
			.where(eq(orderPayments.orderId, data.id))
			.orderBy(orderPayments.paidAt);

		let address: typeof customerAddresses.$inferSelect | null = null;
		if (order.addressId) {
			const [addr] = await db
				.select()
				.from(customerAddresses)
				.where(eq(customerAddresses.id, order.addressId))
				.limit(1);
			address = addr ?? null;
		}

		return { ...order, items, payments, address };
	});
