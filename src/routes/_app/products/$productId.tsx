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
import { Download, ImagePlus } from "lucide-react";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "#/components/ui/form";
import { Input } from "#/components/ui/input";
import { cn } from "#/lib/utils";
import { getProduct } from "#/server/functions/products/get";
import { uploadProductImage } from "#/server/functions/products/upload-image";
import { upsertProduct } from "#/server/functions/products/upsert";
import {
	type UpsertProductInput,
	upsertProductSchema,
} from "#/shared/schemas/product";

type ProductWithUrls = Awaited<ReturnType<typeof getProduct>>;

import { ProductDetailSkeleton } from "#/components/round-skeletons";

export const Route = createFileRoute("/_app/products/$productId")({
	loader: async ({ context: { queryClient }, params }) => {
		if (params.productId === "new") return;
		const promise = queryClient.ensureQueryData({
			queryKey: ["products", params.productId],
			queryFn: () => getProduct({ data: { id: params.productId } }),
		});
		if (typeof window === "undefined") {
			await promise;
		}
	},
	pendingComponent: ProductDetailSkeleton,
	component: ProductDetailPage,
});

function ProductDetailPage() {
	const { productId } = useParams({ from: "/_app/products/$productId" });
	const isNew = productId === "new";

	if (isNew) return <ProductForm product={null} />;

	return <ProductFormLoader productId={productId} />;
}

function ProductFormLoader({ productId }: { productId: string }) {
	const { data: product } = useSuspenseQuery({
		queryKey: ["products", productId],
		queryFn: () => getProduct({ data: { id: productId } }),
	});
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
			if (saved.id) {
				queryClient.invalidateQueries({ queryKey: ["products", saved.id] });
			}
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

			<Form {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
					<PhotoDropZone
						preview={photoPreview}
						storedUrl={product?.imageUrl ?? null}
						onFile={handleFile}
						label={t("products:field.photo")}
						hint={t("products:form.photoHint")}
					/>

					<FormField
						control={form.control}
						name="name"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("products:field.name")}</FormLabel>
								<FormControl>
									<Input
										{...field}
										placeholder={t("products:form.namePlaceholder")}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<div className="grid grid-cols-2 gap-4">
						<FormField
							control={form.control}
							name="brand"
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t("products:field.brand")}</FormLabel>
									<FormControl>
										<Input
											{...field}
											placeholder={t("products:form.brandPlaceholder")}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="sourceCountry"
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t("products:field.sourceCountry")}</FormLabel>
									<FormControl>
										<Input {...field} placeholder="Japan" />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>

					<FormField
						control={form.control}
						name="category"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("products:field.category")}</FormLabel>
								<FormControl>
									<Input
										{...field}
										placeholder={t("products:form.categoryPlaceholder")}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					{upsertMutation.error && (
						<Alert variant="destructive">
							<AlertDescription>
								{(upsertMutation.error as Error).message}
							</AlertDescription>
						</Alert>
					)}

					<div className="flex gap-3 pt-2">
						<Button
							type="button"
							variant="outline"
							onClick={() => navigate({ to: "/products" })}
						>
							{t("common:action.cancel")}
						</Button>
						<Button
							type="submit"
							variant="default"
							disabled={upsertMutation.isPending}
							className="flex-1"
						>
							{upsertMutation.isPending
								? t("common:loading")
								: product
									? t("products:action.save")
									: t("products:action.create")}
						</Button>
					</div>
				</form>
			</Form>
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
			{/* biome-ignore lint/a11y/useSemanticElements: upload container */}
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
						<img src={displaySrc} alt="" className="w-full h-auto block" />
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

			{displaySrc && (
				<a
					href={displaySrc}
					target="_blank"
					rel="noopener noreferrer"
					className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors min-h-[44px] px-1"
				>
					<Download size={14} />
					Download image
				</a>
			)}
			{hint && <p className="text-xs text-muted-foreground">{hint}</p>}
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
