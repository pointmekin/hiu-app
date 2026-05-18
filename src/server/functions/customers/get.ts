import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db/index";
import { customerAddresses, customers } from "#/db/schema";
import { requireSession } from "#/server/middleware";

export const getCustomer = createServerFn({ method: "GET" })
	.inputValidator(z.object({ id: z.string().uuid() }))
	.handler(async ({ data }) => {
		await requireSession();
		const [customer] = await db
			.select()
			.from(customers)
			.where(eq(customers.id, data.id))
			.limit(1);
		if (!customer) throw new Error("Customer not found");

		const addresses = await db
			.select()
			.from(customerAddresses)
			.where(eq(customerAddresses.customerId, data.id))
			.orderBy(customerAddresses.isDefault, customerAddresses.createdAt);

		return { ...customer, addresses };
	});
