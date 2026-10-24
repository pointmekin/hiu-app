import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "#/db/index";
import {
	customerAddresses,
	customers,
	orderItems,
	orders,
	products,
	roundProducts,
} from "#/db/schema";
import { requireSession } from "#/server/middleware";
import { getAddressStatus } from "#/shared/address-status";
import { getEffectivePaymentStatus } from "#/shared/payment-status";
import { listOrdersSchema } from "#/shared/schemas/order";

export const listOrders = createServerFn({ method: "GET" })
	.validator(listOrdersSchema)
	.handler(async ({ data }) => {
		await requireSession();

		const conditions = [eq(orders.roundId, data.roundId)];
		if (data.isPacked !== undefined)
			conditions.push(eq(orders.isPacked, data.isPacked));
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
				isPacked: orders.isPacked,
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

		const addressRows = await db
			.select({
				id: customerAddresses.id,
				customerId: customerAddresses.customerId,
				recipientName: customerAddresses.recipientName,
				mobile: customerAddresses.mobile,
				address: customerAddresses.address,
				postalCode: customerAddresses.postalCode,
			})
			.from(customerAddresses)
			.where(
				inArray(
					customerAddresses.customerId,
					rows.map((r) => r.customerId),
				),
			);

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

		const result = rows.map((order) => ({
			...order,
			paymentStatus: getEffectivePaymentStatus(
				order.paymentStatus,
				Number(order.paidAmountThb),
				Number(order.totalThb),
			),
			items: itemsByOrderId.get(order.id) ?? [],
			addressStatus: getAddressStatus(
				order.addressId,
				addressRows.filter((a) => a.customerId === order.customerId),
			),
		}));

		return data.paymentStatus
			? result.filter((order) => order.paymentStatus === data.paymentStatus)
			: result;
	});
