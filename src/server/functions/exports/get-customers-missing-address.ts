import { createServerFn } from "@tanstack/react-start";
import { and, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { db } from "#/db/index";
import { customerAddresses, customers, orders } from "#/db/schema";
import { requireSession } from "#/server/middleware";

export interface CustomerMissingAddress {
	customerId: string;
	customerName: string;
}

export const getCustomersMissingAddress = createServerFn({ method: "GET" })
	.inputValidator(z.object({ roundId: z.string().uuid() }))
	.handler(async ({ data }): Promise<CustomerMissingAddress[]> => {
		await requireSession();

		const orderAddr = alias(customerAddresses, "order_addr");

		// Mirrors fetchKerryData: prefer order-specific address, fall back to best
		// available customer address (default first, then oldest).
		function bestAddrSq(field: string) {
			return sql`(
				SELECT ${sql.raw(field)} FROM ${customerAddresses}
				WHERE ${customerAddresses.customerId} = ${orders.customerId}
				ORDER BY ${customerAddresses.isDefault} DESC, ${customerAddresses.createdAt} ASC
				LIMIT 1
			)`;
		}

		const rows = await db
			.select({
				customerId: customers.id,
				customerName: customers.displayName,
				resolvedMobile: sql<
					string | null
				>`COALESCE(${orderAddr.mobile}, ${bestAddrSq("mobile")})`,
				resolvedAddress: sql<
					string | null
				>`COALESCE(${orderAddr.address}, ${bestAddrSq("address")})`,
				resolvedPostalCode: sql<
					string | null
				>`COALESCE(${orderAddr.postalCode}, ${bestAddrSq("postal_code")})`,
			})
			.from(orders)
			.innerJoin(customers, eq(orders.customerId, customers.id))
			.leftJoin(orderAddr, eq(orders.addressId, orderAddr.id))
			.where(and(eq(orders.roundId, data.roundId), eq(orders.status, "active")))
			.orderBy(customers.displayName);

		// Track customers as "has address" or "missing" across all their orders.
		// A customer is only flagged if ALL their active orders in this round
		// resolve to an incomplete address.
		const hasAddress = new Set<string>();
		const missing = new Map<string, CustomerMissingAddress>();

		for (const row of rows) {
			const complete =
				row.resolvedMobile != null &&
				row.resolvedMobile.trim() !== "" &&
				row.resolvedAddress != null &&
				row.resolvedAddress.trim() !== "" &&
				row.resolvedPostalCode != null &&
				row.resolvedPostalCode.trim() !== "";

			if (complete) {
				hasAddress.add(row.customerId);
				missing.delete(row.customerId);
			} else if (!hasAddress.has(row.customerId)) {
				missing.set(row.customerId, {
					customerId: row.customerId,
					customerName: row.customerName,
				});
			}
		}

		return Array.from(missing.values());
	});
