import { createServerFn } from "@tanstack/react-start";
import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db/index";
import { orderItems, orders, products, roundProducts } from "#/db/schema";
import { requireSession } from "#/server/middleware";

export const listForPurchaseTracker = createServerFn({ method: "GET" })
	.inputValidator(z.object({ roundId: z.string().uuid() }))
	.handler(async ({ data }) => {
		await requireSession();

		const rows = await db
			.select({
				id: roundProducts.id,
				roundId: roundProducts.roundId,
				productId: roundProducts.productId,
				foreignPrice: roundProducts.foreignPrice,
				storeLocation: roundProducts.storeLocation,
				boughtQty: roundProducts.boughtQty,
				productName: products.name,
				productBrand: products.brand,
				productCategory: products.category,
				orderedQty: sql<number>`COALESCE(SUM(${orderItems.quantity}) FILTER (WHERE ${orders.status} != 'cancelled'), 0)::int`,
			})
			.from(roundProducts)
			.innerJoin(products, eq(roundProducts.productId, products.id))
			.leftJoin(orderItems, eq(orderItems.roundProductId, roundProducts.id))
			.leftJoin(orders, eq(orderItems.orderId, orders.id))
			.where(eq(roundProducts.roundId, data.roundId))
			.groupBy(
				roundProducts.id,
				roundProducts.roundId,
				roundProducts.productId,
				roundProducts.foreignPrice,
				roundProducts.storeLocation,
				roundProducts.boughtQty,
				products.name,
				products.brand,
				products.category,
			)
			.orderBy(
				sql`COALESCE(${roundProducts.storeLocation}, 'zzz')`,
				asc(products.name),
			);

		return rows;
	});

export type PurchaseTrackerItem = Awaited<
	ReturnType<typeof listForPurchaseTracker>
>[number];
