import { createServerFn } from "@tanstack/react-start";
import { db } from "#/db/index";
import { appSettings } from "#/db/schema";
import { writeAudit } from "#/server/audit";
import { requireSession } from "#/server/middleware";
import { updateSettingsSchema } from "#/shared/schemas/settings";

export const updateSettings = createServerFn({ method: "POST" })
	.inputValidator(updateSettingsSchema)
	.handler(async ({ data }) => {
		const session = await requireSession();

		const entries = Object.entries(data) as [string, unknown][];
		for (const [key, value] of entries) {
			await db
				.insert(appSettings)
				.values({ key, value })
				.onConflictDoUpdate({
					target: appSettings.key,
					set: { value, updatedAt: new Date() },
				});
		}

		await writeAudit({
			userId: session.user.id,
			entity: "app_settings",
			entityId: "global",
			action: "update",
			diff: data,
		});

		return { ok: true };
	});
