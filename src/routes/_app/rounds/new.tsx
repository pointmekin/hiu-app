import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { createRound } from "#/server/functions/rounds/create";
import { z } from "zod";
import {
	SOURCE_CURRENCIES,
	createRoundSchema,
} from "#/shared/schemas/round";

type CreateRoundForm = z.input<typeof createRoundSchema>;

export const Route = createFileRoute("/_app/rounds/new")({
	component: NewRoundPage,
});

function NewRoundPage() {
	const { t } = useTranslation(["rounds", "common"]);
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const form = useForm<CreateRoundForm>({
		resolver: zodResolver(createRoundSchema),
		defaultValues: {
			status: "draft",
			sourceCurrency: "JPY",
			fxRate: 0.235,
			perItemFeeTh: 0,
			defaultShippingFee: 50,
		},
	});

	const fxRate = form.watch("fxRate") ?? 0;
	const perItemFee = form.watch("perItemFeeTh") ?? 0;
	const currency = form.watch("sourceCurrency");
	const exampleForeign = currency === "JPY" ? 2800 : 100;
	const computedThb = exampleForeign * fxRate + perItemFee;

	const mutation = useMutation({
		mutationFn: (data: CreateRoundForm) =>
			createRound({ data: data as Parameters<typeof createRound>[0]["data"] }),
		onSuccess: (round) => {
			queryClient.invalidateQueries({ queryKey: ["rounds"] });
			if (round && typeof round === "object" && "id" in round) {
				navigate({
					to: "/rounds/$roundId",
					params: { roundId: (round as { id: string }).id },
				});
			}
		},
	});

	function onSubmit(data: CreateRoundForm) {
		mutation.mutate(data);
	}

	return (
		<div className="max-w-xl mx-auto px-4 py-6">
			<h1 className="text-2xl font-semibold text-foreground mb-6">
				{t("rounds:form.createTitle")}
			</h1>

			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
				<Field label={t("rounds:field.name")} error={form.formState.errors.name?.message}>
					<input
						{...form.register("name")}
						placeholder="Japan May 2026"
						className="input"
					/>
				</Field>

				<Field label={t("rounds:field.country")} error={form.formState.errors.country?.message}>
					<input
						{...form.register("country")}
						placeholder="Japan"
						className="input"
					/>
				</Field>

				<Field label={t("rounds:field.storeHint")}>
					<input
						{...form.register("storeHint")}
						placeholder="Don Quijote, Matsumoto Kiyoshi..."
						className="input"
					/>
				</Field>

				<div className="grid grid-cols-2 gap-4">
					<Field label={t("rounds:field.sourceCurrency")}>
						<select {...form.register("sourceCurrency")} className="input">
							{SOURCE_CURRENCIES.map((c) => (
								<option key={c} value={c}>
									{c}
								</option>
							))}
						</select>
					</Field>

					<Field
						label={t("rounds:field.fxRate")}
						error={form.formState.errors.fxRate?.message}
						hint={t("rounds:form.fxRateHint")}
					>
						<input
							{...form.register("fxRate", { valueAsNumber: true })}
							type="number"
							step="0.0001"
							min="0"
							className="input font-mono"
						/>
					</Field>
				</div>

				<div className="rounded-md bg-bone-soft dark:bg-muted/30 px-4 py-3 text-sm">
					<span className="text-muted-foreground">{t("rounds:form.fxPreview", {
						foreign: exampleForeign.toLocaleString(),
						currency,
						thb: computedThb.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
					})}</span>
				</div>

				<div className="grid grid-cols-2 gap-4">
					<Field label={t("rounds:field.perItemFeeTh")}>
						<input
							{...form.register("perItemFeeTh", { valueAsNumber: true })}
							type="number"
							step="0.01"
							min="0"
							className="input font-mono"
						/>
					</Field>

					<Field label={t("rounds:field.defaultShippingFee")}>
						<input
							{...form.register("defaultShippingFee", { valueAsNumber: true })}
							type="number"
							step="0.01"
							min="0"
							className="input font-mono"
						/>
					</Field>
				</div>

				<div className="grid grid-cols-2 gap-4">
					<Field label={t("rounds:field.purchaseStart")}>
						<input
							{...form.register("purchaseStart")}
							type="date"
							className="input"
						/>
					</Field>

					<Field label={t("rounds:field.purchaseEnd")}>
						<input
							{...form.register("purchaseEnd")}
							type="date"
							className="input"
						/>
					</Field>
				</div>

				<Field label={t("rounds:field.deliveryEta")}>
					<input
						{...form.register("deliveryEta")}
						type="date"
						className="input"
					/>
				</Field>

				<Field label={t("rounds:field.notes")}>
					<textarea
						{...form.register("notes")}
						rows={3}
						className="input resize-none"
					/>
				</Field>

				{mutation.error && (
					<p className="text-sm text-destructive">
						{(mutation.error as Error).message}
					</p>
				)}

				<div className="flex gap-3 pt-2">
					<button
						type="submit"
						disabled={mutation.isPending}
						className="flex-1 rounded-md bg-hanko px-4 py-2.5 text-sm font-semibold text-bone hover:bg-hanko-hover disabled:opacity-50 transition-opacity"
					>
						{mutation.isPending ? t("common:loading") : t("rounds:list.createFirst")}
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
