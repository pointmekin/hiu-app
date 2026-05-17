import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { getRound } from "#/server/functions/rounds/get";
import { updateRound } from "#/server/functions/rounds/update";
import {
	ROUND_STATUSES,
	SOURCE_CURRENCIES,
	type UpdateRoundInput,
	updateRoundSchema,
} from "#/shared/schemas/round";

export const Route = createFileRoute("/_app/rounds/$roundId/")({
	component: RoundOverview,
});

function RoundOverview() {
	const { t } = useTranslation(["rounds", "common"]);
	const { roundId } = useParams({ from: "/_app/rounds/$roundId/" });
	const queryClient = useQueryClient();

	const { data: round } = useSuspenseQuery({
		queryKey: ["rounds", roundId],
		queryFn: () => getRound({ data: { id: roundId } }),
	});

	const form = useForm<UpdateRoundInput>({
		resolver: zodResolver(updateRoundSchema),
		values: {
			id: round.id,
			name: round.name,
			country: round.country,
			storeHint: round.storeHint ?? undefined,
			status: round.status as UpdateRoundInput["status"],
			sourceCurrency:
				round.sourceCurrency as UpdateRoundInput["sourceCurrency"],
			fxRate: Number(round.fxRate),
			perItemFeeTh: Number(round.perItemFeeTh),
			defaultShippingFee: Number(round.defaultShippingFee),
			notes: round.notes ?? undefined,
			purchaseStart: round.purchaseStart
				? new Date(round.purchaseStart).toISOString().split("T")[0]
				: undefined,
			purchaseEnd: round.purchaseEnd
				? new Date(round.purchaseEnd).toISOString().split("T")[0]
				: undefined,
			deliveryEta: round.deliveryEta
				? new Date(round.deliveryEta).toISOString().split("T")[0]
				: undefined,
		},
	});

	const fxRate = form.watch("fxRate") ?? 0;
	const perItemFee = form.watch("perItemFeeTh") ?? 0;
	const currency = form.watch("sourceCurrency");
	const exampleForeign = currency === "JPY" ? 2800 : 100;
	const computedThb = exampleForeign * fxRate + perItemFee;

	const mutation = useMutation({
		mutationFn: (data: UpdateRoundInput) => updateRound({ data }),
		onSuccess: (updated) => {
			queryClient.setQueryData(["rounds", roundId], updated);
			queryClient.invalidateQueries({ queryKey: ["rounds"] });
		},
	});

	function onSubmit(data: UpdateRoundInput) {
		mutation.mutate(data);
	}

	return (
		<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
			<Field
				label={t("rounds:field.name")}
				error={form.formState.errors.name?.message}
			>
				<input {...form.register("name")} className="input" />
			</Field>

			<div className="grid grid-cols-2 gap-4">
				<Field label={t("rounds:field.country")}>
					<input {...form.register("country")} className="input" />
				</Field>
				<Field label={t("rounds:field.storeHint")}>
					<input {...form.register("storeHint")} className="input" />
				</Field>
			</div>

			<Field label={t("rounds:field.status")}>
				<select {...form.register("status")} className="input">
					{ROUND_STATUSES.map((s) => (
						<option key={s} value={s}>
							{t(`rounds:status.${s}`)}
						</option>
					))}
				</select>
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
				<span className="text-muted-foreground">
					{t("rounds:form.fxPreview", {
						foreign: exampleForeign.toLocaleString(),
						currency,
						thb: computedThb.toLocaleString("th-TH", {
							minimumFractionDigits: 2,
							maximumFractionDigits: 2,
						}),
					})}
				</span>
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

			<div className="grid grid-cols-3 gap-4">
				<Field label={t("rounds:field.purchaseStart")}>
					<input {...form.register("purchaseStart")} type="date" className="input" />
				</Field>
				<Field label={t("rounds:field.purchaseEnd")}>
					<input {...form.register("purchaseEnd")} type="date" className="input" />
				</Field>
				<Field label={t("rounds:field.deliveryEta")}>
					<input {...form.register("deliveryEta")} type="date" className="input" />
				</Field>
			</div>

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

			{mutation.isSuccess && (
				<p className="text-sm text-green-600">{t("common:action.save")} ✓</p>
			)}

			<button
				type="submit"
				disabled={mutation.isPending || !form.formState.isDirty}
				className="rounded-md bg-hanko px-4 py-2.5 text-sm font-semibold text-bone hover:bg-hanko-hover disabled:opacity-50 transition-opacity"
			>
				{mutation.isPending ? t("common:loading") : t("common:action.save")}
			</button>
		</form>
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
