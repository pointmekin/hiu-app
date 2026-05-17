import { zodResolver } from "@hookform/resolvers/zod";
import {
	useMutation,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import {
	createFileRoute,
	useNavigate,
	useParams,
} from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import imageCompression from "browser-image-compression";
import { listProducts } from "#/server/functions/products/list";
import { uploadProductImage } from "#/server/functions/products/upload-image";
import { upsertProduct } from "#/server/functions/products/upsert";
import {
	type UpsertProductInput,
	upsertProductSchema,
} from "#/shared/schemas/product";
import type { Product } from "#/db/schema";

export const Route = createFileRoute("/_app/products/$productId")({
	loader: async ({ context: { queryClient }, params }) => {
		if (params.productId === "new") return;
		await queryClient.ensureQueryData({
			queryKey: ["products", ""],
			queryFn: () => listProducts({ data: { q: "", limit: 50 } }),
		});
	},
	component: ProductDetailPage,
});

function ProductDetailPage() {
	const { productId } = useParams({ from: "/_app/products/$productId" });
	const isNew = productId === "new";

	if (isNew) return <ProductForm product={null} />;

	return <ProductFormLoader productId={productId} />;
}

function ProductFormLoader({ productId }: { productId: string }) {
	const { data: products } = useSuspenseQuery({
		queryKey: ["products", ""],
		queryFn: () => listProducts({ data: { q: "", limit: 50 } }),
	});
	const product = products.find((p) => p.id === productId) ?? null;
	return <ProductForm product={product} />;
}

function ProductForm({ product }: { product: Product | null }) {
	const { t } = useTranslation(["products", "common"]);
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const fileRef = useRef<HTMLInputElement>(null);
	const [photoPreview, setPhotoPreview] = useState<string | null>(null);
	const [uploadFile, setUploadFile] = useState<File | null>(null);

	const form = useForm<UpsertProductInput>({
		resolver: zodResolver(upsertProductSchema),
		defaultValues: product
			? {
					id: product.id,
					name: product.name,
					brand: product.brand ?? undefined,
					sourceCountry: product.sourceCountry ?? undefined,
					category: product.category ?? undefined,
				}
			: {},
	});

	const upsertMutation = useMutation({
		mutationFn: (data: UpsertProductInput) => upsertProduct({ data }),
		onSuccess: async (saved) => {
			if (uploadFile) {
				try {
					const compressed = await imageCompression(uploadFile, {
						maxSizeMB: 1,
						maxWidthOrHeight: 1024,
						useWebWorker: true,
					});
					const base64 = await fileToBase64(compressed);
					await uploadProductImage({
						data: {
							productId: saved.id,
							mimeType: compressed.type,
							base64,
						},
					});
				} catch {
					// Photo upload failure is non-fatal
				}
			}
			queryClient.invalidateQueries({ queryKey: ["products"] });
			navigate({ to: "/products" });
		},
	});

	function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;
		setUploadFile(file);
		setPhotoPreview(URL.createObjectURL(file));
	}

	function onSubmit(data: UpsertProductInput) {
		upsertMutation.mutate(data);
	}

	return (
		<div className="max-w-xl mx-auto px-4 py-6">
			<h1 className="text-2xl font-semibold text-foreground mb-6">
				{product ? t("products:form.editTitle") : t("products:form.createTitle")}
			</h1>

			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
				<Field
					label={t("products:field.name")}
					error={form.formState.errors.name?.message}
				>
					<input
						{...form.register("name")}
						placeholder={t("products:form.namePlaceholder")}
						className="input"
					/>
				</Field>

				<div className="grid grid-cols-2 gap-4">
					<Field label={t("products:field.brand")}>
						<input
							{...form.register("brand")}
							placeholder={t("products:form.brandPlaceholder")}
							className="input"
						/>
					</Field>
					<Field label={t("products:field.sourceCountry")}>
						<input
							{...form.register("sourceCountry")}
							placeholder="Japan"
							className="input"
						/>
					</Field>
				</div>

				<Field label={t("products:field.category")}>
					<input
						{...form.register("category")}
						placeholder={t("products:form.categoryPlaceholder")}
						className="input"
					/>
				</Field>

				<Field
					label={t("products:field.photo")}
					hint={t("products:form.photoHint")}
				>
					<div className="flex items-center gap-3">
						{(photoPreview ?? product?.imageKey) && (
							<img
								src={photoPreview ?? undefined}
								alt=""
								className="h-16 w-16 rounded-md object-cover border border-border"
							/>
						)}
						<button
							type="button"
							onClick={() => fileRef.current?.click()}
							className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent"
						>
							{photoPreview || product?.imageKey
								? t("products:form.changePhoto")
								: t("products:form.uploadPhoto")}
						</button>
						<input
							ref={fileRef}
							type="file"
							accept="image/jpeg,image/png,image/webp"
							onChange={handleFileChange}
							className="hidden"
						/>
					</div>
				</Field>

				{upsertMutation.error && (
					<p className="text-sm text-destructive">
						{(upsertMutation.error as Error).message}
					</p>
				)}

				<div className="flex gap-3 pt-2">
					<button
						type="button"
						onClick={() => navigate({ to: "/products" })}
						className="rounded-md border border-border px-4 py-2.5 text-sm hover:bg-accent"
					>
						{t("common:action.cancel")}
					</button>
					<button
						type="submit"
						disabled={upsertMutation.isPending}
						className="flex-1 rounded-md bg-hanko px-4 py-2.5 text-sm font-semibold text-bone hover:bg-hanko-hover disabled:opacity-50"
					>
						{upsertMutation.isPending
							? t("common:loading")
							: product
								? t("products:action.save")
								: t("products:action.create")}
					</button>
				</div>
			</form>
		</div>
	);
}

function Field({
	label,
	hint,
	error,
	children,
}: {
	label: string;
	hint?: string;
	error?: string;
	children: React.ReactNode;
}) {
	return (
		<div className="space-y-1.5">
			<label className="block text-sm font-medium text-foreground">
				{label}
			</label>
			{children}
			{hint && <p className="text-xs text-muted-foreground">{hint}</p>}
			{error && <p className="text-xs text-destructive">{error}</p>}
		</div>
	);
}

async function fileToBase64(file: File | Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			const result = reader.result as string;
			resolve(result.split(",")[1]);
		};
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
}
