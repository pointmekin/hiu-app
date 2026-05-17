import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { z } from "zod";
import { db } from "#/db/index";
import { products } from "#/db/schema";
import { writeAudit } from "#/server/audit";
import { requireSession } from "#/server/middleware";
import { uploadToS3 } from "#/server/s3";

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

function randomHex(len: number): string {
	return Array.from({ length: len }, () =>
		Math.floor(Math.random() * 16).toString(16),
	).join("");
}

export const uploadProductImage = createServerFn({ method: "POST" })
	.inputValidator(
		z.object({
			productId: z.string().uuid(),
			mimeType: z.string(),
			base64: z.string(),
		}),
	)
	.handler(async ({ data }) => {
		const session = await requireSession();

		if (!ALLOWED_MIME.includes(data.mimeType as (typeof ALLOWED_MIME)[number])) {
			throw new Error(`Unsupported file type: ${data.mimeType}`);
		}

		const raw = Buffer.from(data.base64, "base64");
		if (raw.byteLength > MAX_SIZE_BYTES) {
			throw new Error("File too large (max 10 MB)");
		}

		const hash = randomHex(12);
		const baseKey = `products/${data.productId}`;

		const [canonical, thumb] = await Promise.all([
			sharp(raw)
				.resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true })
				.webp({ quality: 80 })
				.toBuffer(),
			sharp(raw)
				.resize({ width: 200, height: 200, fit: "cover" })
				.webp({ quality: 70 })
				.toBuffer(),
		]);

		const canonicalKey = `${baseKey}/canonical-${hash}.webp`;
		const thumbKey = `${baseKey}/thumb-${hash}.webp`;

		await Promise.all([
			uploadToS3({ key: canonicalKey, body: canonical, contentType: "image/webp" }),
			uploadToS3({ key: thumbKey, body: thumb, contentType: "image/webp" }),
		]);

		const [product] = await db
			.update(products)
			.set({ imageKey: canonicalKey, thumbKey })
			.where(eq(products.id, data.productId))
			.returning();

		if (!product) throw new Error("Product not found");

		await writeAudit({
			userId: session.user.id,
			entity: "product",
			entityId: data.productId,
			action: "upload_image",
			diff: { imageKey: canonicalKey, thumbKey },
		});

		return { imageKey: canonicalKey, thumbKey };
	});
