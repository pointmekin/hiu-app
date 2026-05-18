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
import imageCompression from "browser-image-compression";
import { ImagePlus } from "lucide-react";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { cn } from "#/lib/utils";
import { listProducts } from "#/server/functions/products/list";
import { uploadProductImage } from "#/server/functions/products/upload-image";
import { upsertProduct } from "#/server/functions/products/upsert";
import {
	type UpsertProductInput,
	upsertProductSchema,
} from "#/shared/schemas/product";

type ProductWithUrls = Awaited<ReturnType<typeof listProducts>>[number];

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

function ProductForm({ product }: { product: ProductWithUrls | null }) {
	const { t } = useTranslation(["products", "common"]);
	const navigate = useNavigate();
	const queryClient = useQueryClient();
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

	function handleFile(file: File) {
		setUploadFile(file);
		setPhotoPreview(URL.createObjectURL(file));
	}

	function onSubmit(data: UpsertProductInput) {
		upsertMutation.mutate(data);
	}

	return (
		<div className="max-w-xl mx-auto px-4 py-6">
			<h1 className="text-2xl font-semibold text-foreground mb-6">
				{product
					? t("products:form.editTitle")
					: t("products:form.createTitle")}
			</h1>

			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
				<PhotoDropZone
					preview={photoPreview}
					storedUrl={product?.imageUrl ?? null}
					onFile={handleFile}
					label={t("products:field.photo")}
					hint={t("products:form.photoHint")}
				/>

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

function PhotoDropZone({
	preview,
	storedUrl,
	onFile,
	label,
	hint,
}: {
	preview: string | null;
	storedUrl: string | null;
	onFile: (file: File) => void;
	label: string;
	hint?: string;
}) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [isDragging, setIsDragging] = useState(false);
	const displaySrc = preview ?? storedUrl;

	function pickFile(file: File) {
		if (!file.type.startsWith("image/")) return;
		onFile(file);
	}

	function handleDragOver(e: React.DragEvent) {
		e.preventDefault();
		setIsDragging(true);
	}

	function handleDragLeave(e: React.DragEvent) {
		if (!e.currentTarget.contains(e.relatedTarget as Node)) {
			setIsDragging(false);
		}
	}

	function handleDrop(e: React.DragEvent) {
		e.preventDefault();
		setIsDragging(false);
		const file = e.dataTransfer.files[0];
		if (file) pickFile(file);
	}

	function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (file) pickFile(file);
	}

	return (
		<div className="space-y-1.5">
			<span className="block text-sm font-medium text-foreground">{label}</span>

			<div
				role="button"
				tabIndex={0}
				onClick={() => inputRef.current?.click()}
				onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
				onDragOver={handleDragOver}
				onDragLeave={handleDragLeave}
				onDrop={handleDrop}
				className={cn(
					"group relative w-full rounded-xl border-2 cursor-pointer",
					"transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
					displaySrc
						? cn(
								"border-transparent overflow-hidden",
								isDragging && "border-hanko",
							)
						: cn(
								"aspect-video flex flex-col items-center justify-center gap-3",
								isDragging
									? "border-hanko bg-hanko/5"
									: "border-dashed border-border hover:border-muted-foreground/50 hover:bg-accent/30",
							),
				)}
			>
				{displaySrc ? (
					<>
						<img
							src={displaySrc}
							alt=""
							className="w-full h-auto block"
						/>
						<div
							className={cn(
								"absolute inset-0 flex items-center justify-center",
								"bg-black/0 group-hover:bg-black/40 transition-colors duration-150",
								isDragging && "bg-black/40",
							)}
						>
							<div
								className={cn(
									"flex flex-col items-center gap-1.5 text-white opacity-0 group-hover:opacity-100 transition-opacity",
									isDragging && "opacity-100",
								)}
							>
								<ImagePlus size={24} />
								<span className="text-xs font-medium">
									{isDragging ? "Drop to replace" : "Change photo"}
								</span>
							</div>
						</div>
					</>
				) : (
					<>
						<ImagePlus
							size={28}
							className={cn(
								"transition-colors",
								isDragging ? "text-hanko" : "text-muted-foreground",
							)}
						/>
						<div className="text-center">
							<p
								className={cn(
									"text-sm font-medium transition-colors",
									isDragging ? "text-hanko" : "text-foreground",
								)}
							>
								{isDragging
									? "Drop image here"
									: "Drag & drop or click to upload"}
							</p>
							<p className="text-xs text-muted-foreground mt-0.5">
								JPG, PNG, WebP
							</p>
						</div>
					</>
				)}

				<input
					ref={inputRef}
					type="file"
					accept="image/jpeg,image/png,image/webp"
					onChange={handleInputChange}
					className="hidden"
				/>
			</div>

			{hint && <p className="text-xs text-muted-foreground">{hint}</p>}
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
