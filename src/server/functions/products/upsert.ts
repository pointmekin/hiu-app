import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { db } from "#/db/index";
import { products } from "#/db/schema";
import { writeAudit } from "#/server/audit";
import { requireSession } from "#/server/middleware";
import { upsertProductSchema } from "#/shared/schemas/product";

export const upsertProduct = createServerFn({ method: "POST" })
	.inputValidator(upsertProductSchema)
	.handler(async ({ data }) => {
		const session = await requireSession();

		if (data.id) {
			const [product] = await db
				.update(products)
				.set({
					name: data.name,
					brand: data.brand ?? null,
					sourceCountry: data.sourceCountry ?? null,
					category: data.category ?? null,
				})
				.where(eq(products.id, data.id))
				.returning();

			if (!product) throw new Error("Product not found");

			await writeAudit({
				userId: session.user.id,
				entity: "product",
				entityId: product.id,
				action: "update",
				diff: data,
			});

			return product;
		}

		const [product] = await db
			.insert(products)
			.values({
				name: data.name,
				brand: data.brand ?? null,
				sourceCountry: data.sourceCountry ?? null,
				category: data.category ?? null,
			})
			.returning();

		await writeAudit({
			userId: session.user.id,
			entity: "product",
			entityId: product.id,
			action: "create",
			diff: data,
		});

		return product;
	});
