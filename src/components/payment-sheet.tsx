import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm, type Resolver } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { recordPayment } from "#/server/functions/payments/record"
import {
	PAYMENT_METHODS,
	PAYMENT_TYPES,
	recordPaymentSchema,
	type RecordPaymentInput,
} from "#/shared/schemas/payment"
import { Alert, AlertDescription } from "#/components/ui/alert"
import { Button } from "#/components/ui/button"
import {
	Form,
	FormControl,
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
import {
	Sheet,
	SheetBody,
	SheetContent,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "#/components/ui/sheet"
import { Textarea } from "#/components/ui/textarea"

interface PaymentSheetProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	orderId: string
	orderNumber: string
	totalThb: number
	paidAmountThb: number
}

export function PaymentSheet({
	open,
	onOpenChange,
	orderId,
	orderNumber,
	totalThb,
	paidAmountThb,
}: PaymentSheetProps) {
	const { t } = useTranslation("payments")
	const { t: tc } = useTranslation("common")
	const queryClient = useQueryClient()

	const form = useForm<RecordPaymentInput>({
		resolver: zodResolver(recordPaymentSchema) as Resolver<RecordPaymentInput>,
		defaultValues: {
			orderId,
			amountThb: undefined as unknown as number,
			type: "full",
			method: "bank_transfer",
			notes: "",
		},
	})

	const mutation = useMutation({
		mutationFn: (data: RecordPaymentInput) => recordPayment({ data }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["orders", orderId] })
			queryClient.invalidateQueries({ queryKey: ["orders"] })
			form.reset()
			onOpenChange(false)
		},
	})

	function onSubmit(data: RecordPaymentInput) {
		mutation.mutate(data)
	}

	const balance = totalThb - paidAmountThb

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent>
				<SheetHeader>
					<SheetTitle>{t("record.title")}</SheetTitle>
					<p className="text-sm text-muted-foreground">
						{orderNumber} · {t("history.title")}:{" "}
						<span className="font-mono font-medium text-foreground">
							{totalThb.toLocaleString("th-TH", {
								minimumFractionDigits: 2,
							})}{" "}
							฿
						</span>
						{" · "}
						{tc("loading").includes("...") ? "" : "คงเหลือ"}{" "}
						<span className="font-mono font-medium text-foreground">
							{balance.toLocaleString("th-TH", {
								minimumFractionDigits: 2,
							})}{" "}
							฿
						</span>
					</p>
				</SheetHeader>

				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">
						<SheetBody className="space-y-4">
							<FormField
								control={form.control}
								name="amountThb"
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t("record.amount")}</FormLabel>
										<FormControl>
											<Input
												{...field}
												type="number"
												step="0.01"
												min="0.01"
												inputMode="decimal"
												className="font-mono text-lg h-12"
												placeholder="0.00"
												onChange={(e) => field.onChange(e.target.valueAsNumber)}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="type"
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t("record.type")}</FormLabel>
										<div className="grid grid-cols-2 gap-2">
											{PAYMENT_TYPES.map((type) => (
												<button
													key={type}
													type="button"
													onClick={() => field.onChange(type)}
													className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
														field.value === type
															? "border-hanko bg-hanko/10 text-hanko"
															: "border-border bg-background text-muted-foreground hover:bg-accent"
													}`}
												>
													{t(`type.${type}`)}
												</button>
											))}
										</div>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="method"
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t("record.method")}</FormLabel>
										<Select onValueChange={field.onChange} value={field.value}>
											<FormControl>
												<SelectTrigger>
													<SelectValue />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												{PAYMENT_METHODS.map((m) => (
													<SelectItem key={m} value={m}>
														{t(`method.${m}`)}
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
								name="notes"
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t("record.notes")}</FormLabel>
										<FormControl>
											<Textarea
												{...field}
												rows={2}
												className="resize-none"
												placeholder="..."
											/>
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
						</SheetBody>

						<SheetFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => onOpenChange(false)}
							>
								{tc("action.cancel")}
							</Button>
							<Button
								type="submit"
								variant="brand"
								disabled={mutation.isPending}
							>
								{mutation.isPending ? tc("loading") : tc("action.save")}
							</Button>
						</SheetFooter>
					</form>
				</Form>
			</SheetContent>
		</Sheet>
	)
}
