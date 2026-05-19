import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, useParams } from "@tanstack/react-router"
import { Suspense } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { RoundOverviewSkeleton } from "#/components/round-skeletons"
import { Alert, AlertDescription } from "#/components/ui/alert"
import { Button } from "#/components/ui/button"
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "#/components/ui/form"
import { Input } from "#/components/ui/input"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select"
import { Textarea } from "#/components/ui/textarea"
import { getRound } from "#/server/functions/rounds/get"
import { updateRound } from "#/server/functions/rounds/update"
import {
	ROUND_STATUSES,
	SOURCE_CURRENCIES,
	type UpdateRoundInput,
	updateRoundSchema,
} from "#/shared/schemas/round"

export const Route = createFileRoute("/_app/rounds/$roundId/")({
	component: () => (
		<Suspense fallback={<RoundOverviewSkeleton />}>
			<RoundOverview />
		</Suspense>
	),
})

function RoundOverview() {
	const { t } = useTranslation(["rounds", "common"])
	const { roundId } = useParams({ from: "/_app/rounds/$roundId/" })
	const queryClient = useQueryClient()

	const { data: round } = useSuspenseQuery({
		queryKey: ["rounds", roundId],
		queryFn: () => getRound({ data: { id: roundId } }),
	})

	const form = useForm<UpdateRoundInput>({
		resolver: zodResolver(updateRoundSchema) as Resolver<UpdateRoundInput>,
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
	})

	const fxRate = form.watch("fxRate") ?? 0
	const perItemFee = form.watch("perItemFeeTh") ?? 0
	const currency = form.watch("sourceCurrency")
	const exampleForeign = currency === "JPY" ? 2800 : 100
	const computedThb = exampleForeign * fxRate + perItemFee

	const mutation = useMutation({
		mutationFn: (data: UpdateRoundInput) => updateRound({ data }),
		onSuccess: (updated) => {
			queryClient.setQueryData(["rounds", roundId], updated)
			queryClient.invalidateQueries({ queryKey: ["rounds"] })
		},
	})

	function onSubmit(data: UpdateRoundInput) {
		mutation.mutate(data)
	}

	return (
		<div className="max-w-2xl">
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
				<FormField
					control={form.control}
					name="name"
					render={({ field }) => (
						<FormItem>
							<FormLabel>{t("rounds:field.name")}</FormLabel>
							<FormControl>
								<Input {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<div className="grid grid-cols-2 gap-4">
					<FormField
						control={form.control}
						name="country"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("rounds:field.country")}</FormLabel>
								<FormControl>
									<Input {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={form.control}
						name="storeHint"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("rounds:field.storeHint")}</FormLabel>
								<FormControl>
									<Input {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
				</div>

				<FormField
					control={form.control}
					name="status"
					render={({ field }) => (
						<FormItem>
							<FormLabel>{t("rounds:field.status")}</FormLabel>
							<Select onValueChange={field.onChange} value={field.value}>
								<FormControl>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
								</FormControl>
								<SelectContent>
									{ROUND_STATUSES.map((s) => (
										<SelectItem key={s} value={s}>
											{t(`rounds:status.${s}`)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<FormMessage />
						</FormItem>
					)}
				/>

				<div className="grid grid-cols-2 gap-4">
					<FormField
						control={form.control}
						name="sourceCurrency"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("rounds:field.sourceCurrency")}</FormLabel>
								<Select onValueChange={field.onChange} value={field.value}>
									<FormControl>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
									</FormControl>
									<SelectContent>
										{SOURCE_CURRENCIES.map((c) => (
											<SelectItem key={c} value={c}>
												{c}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="fxRate"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("rounds:field.fxRate")}</FormLabel>
								<FormControl>
									<Input
										{...field}
										type="number"
										step="0.0001"
										min="0"
										className="font-mono"
										onChange={(e) => field.onChange(e.target.valueAsNumber)}
									/>
								</FormControl>
								<FormDescription>{t("rounds:form.fxRateHint")}</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>
				</div>

				<Alert>
					<AlertDescription>
						{t("rounds:form.fxPreview", {
							foreign: exampleForeign.toLocaleString(),
							currency,
							thb: computedThb.toLocaleString("th-TH", {
								minimumFractionDigits: 2,
								maximumFractionDigits: 2,
							}),
						})}
					</AlertDescription>
				</Alert>

				<div className="grid grid-cols-2 gap-4">
					<FormField
						control={form.control}
						name="perItemFeeTh"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("rounds:field.perItemFeeTh")}</FormLabel>
								<FormControl>
									<Input
										{...field}
										type="number"
										step="0.01"
										min="0"
										className="font-mono"
										onChange={(e) => field.onChange(e.target.valueAsNumber)}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={form.control}
						name="defaultShippingFee"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("rounds:field.defaultShippingFee")}</FormLabel>
								<FormControl>
									<Input
										{...field}
										type="number"
										step="0.01"
										min="0"
										className="font-mono"
										onChange={(e) => field.onChange(e.target.valueAsNumber)}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
				</div>

				<div className="grid grid-cols-3 gap-4">
					<FormField
						control={form.control}
						name="purchaseStart"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("rounds:field.purchaseStart")}</FormLabel>
								<FormControl>
									<Input {...field} type="date" />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={form.control}
						name="purchaseEnd"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("rounds:field.purchaseEnd")}</FormLabel>
								<FormControl>
									<Input {...field} type="date" />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={form.control}
						name="deliveryEta"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("rounds:field.deliveryEta")}</FormLabel>
								<FormControl>
									<Input {...field} type="date" />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
				</div>

				<FormField
					control={form.control}
					name="notes"
					render={({ field }) => (
						<FormItem>
							<FormLabel>{t("rounds:field.notes")}</FormLabel>
							<FormControl>
								<Textarea {...field} rows={3} className="resize-none" />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				{mutation.error && (
					<Alert variant="destructive">
						<AlertDescription>
							{(mutation.error as Error).message}
						</AlertDescription>
					</Alert>
				)}

				{mutation.isSuccess && (
					<Alert>
						<AlertDescription>{t("common:action.save")} ✓</AlertDescription>
					</Alert>
				)}

				<Button
					type="submit"
					variant="default"
					disabled={mutation.isPending || !form.formState.isDirty}
				>
					{mutation.isPending ? t("common:loading") : t("common:action.save")}
				</Button>
			</form>
		</Form>
		</div>
	)
}
