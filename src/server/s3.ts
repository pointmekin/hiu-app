import {
	DeleteObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";

function getS3Config() {
	const region = process.env.AWS_REGION;
	const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
	const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
	const bucket = process.env.S3_BUCKET;

	if (!region || !accessKeyId || !secretAccessKey || !bucket) {
		throw new Error(
			"S3 environment variables not configured (AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET)",
		);
	}

	const publicUrl =
		process.env.S3_PUBLIC_URL ??
		`https://${bucket}.s3.${region}.amazonaws.com`;

	return { region, accessKeyId, secretAccessKey, bucket, publicUrl };
}

function getClient() {
	const { region, accessKeyId, secretAccessKey } = getS3Config();
	return new S3Client({ region, credentials: { accessKeyId, secretAccessKey } });
}

export async function uploadToS3({
	key,
	body,
	contentType,
}: {
	key: string;
	body: Buffer;
	contentType: string;
}): Promise<string> {
	const { bucket, publicUrl } = getS3Config();
	const client = getClient();

	await client.send(
		new PutObjectCommand({
			Bucket: bucket,
			Key: key,
			Body: body,
			ContentType: contentType,
			CacheControl: "public, max-age=31536000, immutable",
		}),
	);

	return `${publicUrl}/${key}`;
}

export async function deleteFromS3(key: string): Promise<void> {
	const { bucket } = getS3Config();
	const client = getClient();

	await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export function s3KeyUrl(key: string): string {
	const { publicUrl } = getS3Config();
	return `${publicUrl}/${key}`;
}
