import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PlusCircle } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { cn } from "#/lib/utils";
import { createProductAndAddToRound } from "#/server/functions/products/create-and-add-to-round";
import { computeSellPriceThb } from "#/shared/pricing";

export interface InlineCreatedProduct {
	id: string;
	productId: string;
	productName: string;
	productBrand: string | null;
	sellPriceThb: string;
}

interface Props {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	roundId: string;
	sourceCurrency: string;
	fxRate: number;
	perItemFeeThb: number;
	onCreated: (rp: InlineCreatedProduct) => void;
}

export function InlineProductDialog({
	open,
	onOpenChange,
	roundId,
	sourceCurrency,
	fxRate,
	perItemFeeThb,
	onCreated,
}: Props) {
	const { t } = useTranslation(["products", "common"]);
	const queryClient = useQueryClient();

	const [name, setName] = useState("");
	const [brand, setBrand] = useState("");
	const [priceStr, setPriceStr] = useState("");
	const [priceMode, setPriceMode] = useState<"foreign" | "thb">("thb");

	const price = priceStr ? Number(priceStr) : null;
	const isThb = priceMode === "thb";
	const previewThb =
		!isThb && price !== null && !Number.isNaN(price)
			? computeSellPriceThb(price, priceMode, fxRate, perItemFeeThb)
			: null;

	const mutation = useMutation({
		mutationFn: () =>
			createProductAndAddToRound({
				data: {
					roundId,
					name,
					brand: brand.trim() || undefined,
					priceMode,
					price: price ?? 0,
				},
			}),
		onSuccess: (rp) => {
			queryClient.invalidateQueries({ queryKey: ["round-products", roundId] });
			onCreated({
				id: rp.id,
				productId: rp.productId,
				productName: rp.productName,
				productBrand: rp.productBrand,
				sellPriceThb: rp.sellPriceThb,
			});
			setName("");
			setBrand("");
			setPriceStr("");
			setPriceMode("thb");
			onOpenChange(false);
		},
	});

	const canSave =
		name.trim().length > 0 &&
		price !== null &&
		price >= 0 &&
		!mutation.isPending;

	function handleOpenChange(next: boolean) {
		if (!mutation.isPending) {
			onOpenChange(next);
		}
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="max-w-sm">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<PlusCircle size={18} className="text-brand" />
						{t("products:form.createTitle")}
					</DialogTitle>
				</DialogHeader>

				<div className="space-y-4 pt-1">
					<div className="space-y-1.5">
						<Label>{t("products:field.name")}</Label>
						<Input
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder={t("products:form.namePlaceholder")}
							autoFocus
						/>
					</div>

					<div className="space-y-1.5">
						<Label>
							{t("products:field.brand")}{" "}
							<span className="text-muted-foreground text-xs font-normal">
								({t("common:optional")})
							</span>
						</Label>
						<Input
							value={brand}
							onChange={(e) => setBrand(e.target.value)}
							placeholder={t("products:form.brandPlaceholder")}
						/>
					</div>

					<div className="space-y-1.5">
						<div className="flex items-center justify-between gap-2">
							<Label>
								{isThb
									? t("products:field.thbPrice")
									: t("products:field.foreignPrice", {
											currency: sourceCurrency,
										})}
							</Label>
							<div className="inline-flex rounded-md border border-border p-0.5">
								<button
									type="button"
									onClick={() => setPriceMode("foreign")}
									className={cn(
										"px-2.5 py-1 text-xs rounded font-mono transition-colors",
										!isThb
											? "bg-accent text-foreground"
											: "text-muted-foreground hover:text-foreground",
									)}
								>
									{t("products:form.priceMode.foreign")}
								</button>
								<button
									type="button"
									onClick={() => setPriceMode("thb")}
									className={cn(
										"px-2.5 py-1 text-xs rounded font-mono transition-colors",
										isThb
											? "bg-accent text-foreground"
											: "text-muted-foreground hover:text-foreground",
									)}
								>
									{t("products:form.priceMode.thb")}
								</button>
							</div>
						</div>
						<div className="relative">
							<span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-mono">
								{isThb ? "฿" : sourceCurrency}
							</span>
							<Input
								type="number"
								min="0"
								step="any"
								value={priceStr}
								onChange={(e) => setPriceStr(e.target.value)}
								className="pl-12 font-mono"
								inputMode="decimal"
							/>
						</div>
						{previewThb !== null && (
							<p className="text-sm text-muted-foreground">
								≈{" "}
								<span className="font-mono tabular-nums">
									{previewThb.toLocaleString("th-TH", {
										minimumFractionDigits: 2,
									})}{" "}
									฿
								</span>
							</p>
						)}
					</div>

					{mutation.error && (
						<p className="text-sm text-destructive">
							{(mutation.error as Error).message}
						</p>
					)}
				</div>

				<div className="flex gap-2 justify-end pt-2">
					<Button
						variant="outline"
						onClick={() => handleOpenChange(false)}
						disabled={mutation.isPending}
					>
						{t("common:action.cancel")}
					</Button>
					<Button
						variant="default"
						disabled={!canSave}
						onClick={() => mutation.mutate()}
					>
						{mutation.isPending ? t("common:loading") : t("common:action.save")}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
