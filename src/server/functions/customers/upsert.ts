import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { db } from "#/db/index";
import { customerAddresses, customers } from "#/db/schema";
import { writeAudit } from "#/server/audit";
import { requireSession } from "#/server/middleware";
import { upsertCustomerSchema } from "#/shared/schemas/customer";

export const upsertCustomer = createServerFn({ method: "POST" })
	.inputValidator(upsertCustomerSchema)
	.handler(async ({ data }) => {
		const session = await requireSession();
		const { address, ...customerData } = data;

		let customerId: string;

		if (customerData.id) {
			const [updated] = await db
				.update(customers)
				.set({
					displayName: customerData.displayName,
					lineId: customerData.lineId ?? null,
					instagramHandle: customerData.instagramHandle ?? null,
					phone: customerData.phone ?? null,
					notes: customerData.notes ?? null,
				})
				.where(eq(customers.id, customerData.id))
				.returning({ id: customers.id });
			if (!updated) throw new Error("Customer not found");
			customerId = updated.id;
			await writeAudit({
				userId: session.user.id,
				entity: "customer",
				entityId: customerId,
				action: "update",
				diff: customerData,
			});
		} else {
			const [created] = await db
				.insert(customers)
				.values({
					displayName: customerData.displayName,
					lineId: customerData.lineId ?? null,
					instagramHandle: customerData.instagramHandle ?? null,
					phone: customerData.phone ?? null,
					notes: customerData.notes ?? null,
				})
				.returning({ id: customers.id });
			customerId = created.id;
			await writeAudit({
				userId: session.user.id,
				entity: "customer",
				entityId: customerId,
				action: "create",
				diff: customerData,
			});
		}

		if (address) {
			if (address.id) {
				await db
					.update(customerAddresses)
					.set({
						recipientName: address.recipientName,
						mobile: address.mobile,
						address: address.address,
						postalCode: address.postalCode,
						isDefault: address.isDefault,
					})
					.where(eq(customerAddresses.id, address.id));
			} else {
				if (address.isDefault) {
					// Clear other defaults first
					await db
						.update(customerAddresses)
						.set({ isDefault: false })
						.where(eq(customerAddresses.customerId, customerId));
				}
				await db.insert(customerAddresses).values({
					customerId,
					recipientName: address.recipientName,
					mobile: address.mobile,
					address: address.address,
					postalCode: address.postalCode,
					isDefault: address.isDefault,
				});
			}
		}

		return { id: customerId };
	});
