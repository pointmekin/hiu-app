import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useForm, type Resolver } from "react-hook-form"
import { useTranslation } from "react-i18next"
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
import { createRound } from "#/server/functions/rounds/create"
import {
	type CreateRoundInput,
	createRoundSchema,
	SOURCE_CURRENCIES,
} from "#/shared/schemas/round"

export const Route = createFileRoute("/_app/rounds/new")({
	component: NewRoundPage,
})

function NewRoundPage() {
	const { t } = useTranslation(["rounds", "common"])
	const navigate = useNavigate()
	const queryClient = useQueryClient()

	const form = useForm<CreateRoundInput>({
		resolver: zodResolver(createRoundSchema) as Resolver<CreateRoundInput>,
		defaultValues: {
			status: "draft",
			sourceCurrency: "JPY",
			fxRate: 0.235,
			perItemFeeTh: 0,
			defaultShippingFee: 50,
		},
	})

	const fxRate = form.watch("fxRate") ?? 0
	const perItemFee = form.watch("perItemFeeTh") ?? 0
	const currency = form.watch("sourceCurrency")
	const exampleForeign = currency === "JPY" ? 2800 : 100
	const computedThb = exampleForeign * fxRate + perItemFee

	const mutation = useMutation({
		mutationFn: (data: CreateRoundInput) => createRound({ data }),
		onSuccess: (round) => {
			queryClient.invalidateQueries({ queryKey: ["rounds"] })
			navigate({ to: "/rounds/$roundId", params: { roundId: round.id } })
		},
	})

	function onSubmit(data: CreateRoundInput) {
		mutation.mutate(data)
	}

	return (
		<div className="max-w-xl mx-auto px-4 py-6">
			<h1 className="text-2xl font-semibold text-foreground mb-6">
				{t("rounds:form.createTitle")}
			</h1>

			<Form {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
					<FormField
						control={form.control}
						name="name"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("rounds:field.name")}</FormLabel>
								<FormControl>
									<Input {...field} placeholder="Japan May 2026" />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="country"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("rounds:field.country")}</FormLabel>
								<FormControl>
									<Input {...field} placeholder="Japan" />
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
									<Input
										{...field}
										placeholder="Don Quijote, Matsumoto Kiyoshi..."
									/>
								</FormControl>
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

					<div className="grid grid-cols-2 gap-4">
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
					</div>

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

					<div className="flex gap-3 pt-2">
						<Button
							type="submit"
							variant="default"
							disabled={mutation.isPending}
							className="flex-1"
						>
							{mutation.isPending
								? t("common:loading")
								: t("rounds:list.createFirst")}
						</Button>
					</div>
				</form>
			</Form>
		</div>
	)
}
