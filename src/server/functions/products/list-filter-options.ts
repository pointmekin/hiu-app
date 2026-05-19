import { createServerFn } from "@tanstack/react-start";
import { sql } from "drizzle-orm";
import { db } from "#/db/index";
import { requireSession } from "#/server/middleware";

export const listProductFilterOptions = createServerFn({ method: "GET" }).handler(
	async () => {
		await requireSession();

		const [brandRows, categoryRows, countryRows] = await Promise.all([
			db.execute(
				sql`select distinct brand from products where brand is not null and brand != '' order by brand`,
			),
			db.execute(
				sql`select distinct category from products where category is not null and category != '' order by category`,
			),
			db.execute(
				sql`select distinct source_country from products where source_country is not null and source_country != '' order by source_country`,
			),
		]);

		return {
			brands: (brandRows.rows as Array<{ brand: string }>).map((r) => r.brand),
			categories: (categoryRows.rows as Array<{ category: string }>).map((r) => r.category),
			sourceCountries: (countryRows.rows as Array<{ source_country: string }>).map(
				(r) => r.source_country,
			),
		};
	},
);
