import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq } from "drizzle-orm";
import { db } from "#/db/index";
import { customers, orders } from "#/db/schema";
import { requireSession } from "#/server/middleware";
import { listOrdersSchema } from "#/shared/schemas/order";

export const listOrders = createServerFn({ method: "GET" })
	.inputValidator(listOrdersSchema)
	.handler(async ({ data }) => {
		await requireSession();

		const conditions = [eq(orders.roundId, data.roundId)];
		if (data.paymentStatus) conditions.push(eq(orders.paymentStatus, data.paymentStatus));
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

		return rows;
	});
