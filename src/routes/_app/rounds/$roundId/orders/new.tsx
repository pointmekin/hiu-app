import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import {
	createFileRoute,
	useNavigate,
	useParams,
} from "@tanstack/react-router"
import { Minus, Package, Plus, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { CustomerCombobox, type CustomerOption } from "#/components/customer-combobox"
import { Alert, AlertDescription } from "#/components/ui/alert"
import { Button } from "#/components/ui/button"
import { Card } from "#/components/ui/card"
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "#/components/ui/command"
import { Input } from "#/components/ui/input"
import { Label } from "#/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "#/components/ui/popover"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select"
import { Separator } from "#/components/ui/separator"
import { getCustomer } from "#/server/functions/customers/get"
import { createOrder } from "#/server/functions/orders/create"
import { listRoundProducts } from "#/server/functions/round-products/list"
import { getRound } from "#/server/functions/rounds/get"
import { getSettings } from "#/server/functions/settings/get"
import {
	useOrderDraft,
	useOrderDraftTotal,
} from "#/store/order-draft"
import { useState } from "react"

export const Route = createFileRoute("/_app/rounds/$roundId/orders/new")({
	loader: async ({ context: { queryClient }, params }) => {
		await Promise.all([
			queryClient.ensureQueryData({
				queryKey: ["rounds", params.roundId],
				queryFn: () => getRound({ data: { id: params.roundId } }),
			}),
			queryClient.ensureQueryData({
				queryKey: ["round-products", params.roundId],
				queryFn: () => listRoundProducts({ data: { roundId: params.roundId } }),
			}),
			queryClient.ensureQueryData({
				queryKey: ["settings"],
				queryFn: () => getSettings(),
			}),
		])
	},
	component: NewOrderPage,
})

function NewOrderPage() {
	const { t } = useTranslation(["orders", "common"])
	const { roundId } = useParams({ from: "/_app/rounds/$roundId/orders/new" })
	const navigate = useNavigate()
	const queryClient = useQueryClient()

	const { data: round } = useSuspenseQuery({
		queryKey: ["rounds", roundId],
		queryFn: () => getRound({ data: { id: roundId } }),
	})

	const { data: roundProductRows } = useSuspenseQuery({
		queryKey: ["round-products", roundId],
		queryFn: () => listRoundProducts({ data: { roundId } }),
	})

	const { data: settings } = useSuspenseQuery({
		queryKey: ["settings"],
		queryFn: () => getSettings(),
	})

	const shippingPresets: number[] = settings?.shippingFeePresets ?? [39, 50, 80]

	const draft = useOrderDraft()
	const total = useOrderDraftTotal()

	// Init draft for this round (no-op if already this round)
	if (draft.roundId !== roundId) {
		draft.initDraft(roundId, Number(round.defaultShippingFee))
	}

	const { data: customerData } = useQuery({
		queryKey: ["customers", draft.customerId],
		queryFn: () =>
			draft.customerId ? getCustomer({ data: { id: draft.customerId } }) : null,
		enabled: !!draft.customerId,
	})

	const [productSearchOpen, setProductSearchOpen] = useState(false)
	const [productQuery, setProductQuery] = useState("")

	const filteredProducts = roundProductRows.filter(
		(rp) =>
			!productQuery ||
			rp.productName.toLowerCase().includes(productQuery.toLowerCase()) ||
			(rp.productBrand ?? "").toLowerCase().includes(productQuery.toLowerCase()),
	)

	const mutation = useMutation({
		mutationFn: () =>
			createOrder({
				data: {
					roundId,
					customerId: draft.customerId!,
					addressId: draft.addressId ?? undefined,
					shippingFeeThb: draft.shippingFeeThb,
					notes: draft.notes || undefined,
					items: draft.items.map((item) => ({
						roundProductId: item.roundProductId,
						quantity: item.quantity,
						unitPriceThb: item.unitPriceThb,
					})),
				},
			}),
		onSuccess: (order) => {
			queryClient.invalidateQueries({ queryKey: ["orders", roundId] })
			draft.reset()
			navigate({
				to: "/rounds/$roundId/orders/$orderId",
				params: { roundId, orderId: order.id },
			})
		},
	})

	const canSubmit =
		!!draft.customerId && draft.items.length > 0 && !mutation.isPending

	function handleCustomerSelect(customer: CustomerOption) {
		const defaultAddr = customerData?.addresses.find((a) => a.isDefault)
		draft.setCustomer(customer.id, customer.display_name, defaultAddr?.id)
	}

	return (
		<div className="space-y-5 pb-32">
			<h2 className="text-lg font-semibold">{t("orders:form.newTitle")}</h2>

			{/* Customer picker */}
			<div className="space-y-1.5">
				<Label>{t("orders:field.customer")}</Label>
				<CustomerCombobox
					value={draft.customerId}
					customerName={draft.customerName}
					onChange={handleCustomerSelect}
				/>
			</div>

			{/* Address picker */}
			{customerData && customerData.addresses.length > 0 && (
				<div className="space-y-1.5">
					<Label>{t("orders:field.address")}</Label>
					<Select
						value={draft.addressId ?? "none"}
						onValueChange={(v) =>
							draft.setAddress(v === "none" ? "" : v)
						}
					>
						<SelectTrigger>
							<SelectValue placeholder={t("orders:form.selectAddress")} />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="none">{t("orders:form.selectAddress")}</SelectItem>
							{customerData.addresses.map((addr) => (
								<SelectItem key={addr.id} value={addr.id}>
									{addr.recipientName} · {addr.address.slice(0, 30)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			)}

			<Separator />

			{/* Product picker */}
			<div className="space-y-1.5">
				<Label>{t("orders:form.addItem")}</Label>
				<Popover open={productSearchOpen} onOpenChange={setProductSearchOpen}>
					<PopoverTrigger asChild>
						<Button variant="outline" className="w-full justify-start text-muted-foreground font-normal">
							<Package size={16} className="mr-2" />
							{t("orders:form.searchProducts")}
						</Button>
					</PopoverTrigger>
					<PopoverContent className="w-[340px] p-0" align="start">
						<Command shouldFilter={false}>
							<CommandInput
								placeholder={t("orders:form.searchProducts")}
								value={productQuery}
								onValueChange={setProductQuery}
							/>
							<CommandList>
								<CommandEmpty>ไม่พบสินค้า</CommandEmpty>
								<CommandGroup>
									{filteredProducts.map((rp) => (
										<CommandItem
											key={rp.id}
											value={rp.id}
											onSelect={() => {
												draft.addItem({
													roundProductId: rp.id,
													productName: rp.productName,
													productBrand: rp.productBrand,
													unitPriceThb: Number(rp.sellPriceThb),
												})
												setProductSearchOpen(false)
												setProductQuery("")
											}}
										>
											<div className="min-w-0 flex-1">
												<p className="font-medium truncate">{rp.productName}</p>
												{rp.productBrand && (
													<p className="text-xs text-muted-foreground">{rp.productBrand}</p>
												)}
											</div>
											<span className="font-mono text-sm ml-2 shrink-0">
												{Number(rp.sellPriceThb).toLocaleString("th-TH", {
													minimumFractionDigits: 0,
												})}{" "}
												฿
											</span>
										</CommandItem>
									))}
								</CommandGroup>
							</CommandList>
						</Command>
					</PopoverContent>
				</Popover>
			</div>

			{/* Line items */}
			{draft.items.length > 0 ? (
				<div className="space-y-2">
					{draft.items.map((item) => (
						<Card key={item.roundProductId} className="px-4 py-3">
							<div className="flex items-center gap-3">
								<div className="flex-1 min-w-0">
									<p className="font-medium text-sm truncate">{item.productName}</p>
									<p className="text-xs text-muted-foreground font-mono">
										{item.unitPriceThb.toLocaleString("th-TH", {
											minimumFractionDigits: 0,
										})}{" "}
										฿ × {item.quantity} ={" "}
										{(item.unitPriceThb * item.quantity).toLocaleString("th-TH", {
											minimumFractionDigits: 0,
										})}{" "}
										฿
									</p>
								</div>
								<div className="flex items-center gap-2 shrink-0">
									<Button
										type="button"
										variant="outline"
										size="icon-xs"
										onClick={() =>
											draft.updateItemQty(item.roundProductId, item.quantity - 1)
										}
									>
										<Minus size={12} />
									</Button>
									<span className="w-7 text-center font-mono text-sm tabular-nums">
										{item.quantity}
									</span>
									<Button
										type="button"
										variant="outline"
										size="icon-xs"
										onClick={() =>
											draft.updateItemQty(item.roundProductId, item.quantity + 1)
										}
									>
										<Plus size={12} />
									</Button>
									<Button
										type="button"
										variant="ghost"
										size="icon-xs"
										onClick={() => draft.removeItem(item.roundProductId)}
										className="text-destructive hover:text-destructive"
									>
										<Trash2 size={12} />
									</Button>
								</div>
							</div>
						</Card>
					))}
				</div>
			) : (
				<p className="text-sm text-muted-foreground">{t("orders:form.noItems")}</p>
			)}

			<Separator />

			{/* Shipping fee */}
			<div className="space-y-2">
				<Label>{t("orders:field.shippingFee")}</Label>
				<div className="flex items-center gap-2">
					<Input
						type="number"
						step="1"
						min="0"
						value={draft.shippingFeeThb}
						onChange={(e) => draft.setShippingFee(Number(e.target.value))}
						className="w-28 font-mono"
					/>
					<div className="flex gap-1">
						{shippingPresets.map((preset) => (
							<Button
								key={preset}
								type="button"
								variant={draft.shippingFeeThb === preset ? "brand" : "outline"}
								size="sm"
								onClick={() => draft.setShippingFee(preset)}
								className="font-mono"
							>
								{preset}
							</Button>
						))}
					</div>
				</div>
			</div>

			{/* Notes */}
			<div className="space-y-1.5">
				<Label>{t("orders:field.notes")}</Label>
				<Input
					value={draft.notes}
					onChange={(e) => draft.setNotes(e.target.value)}
					placeholder="..."
				/>
			</div>

			{mutation.error && (
				<Alert variant="destructive">
					<AlertDescription>
						{(mutation.error as Error).message}
					</AlertDescription>
				</Alert>
			)}

			{/* Sticky bottom CTA */}
			<div className="fixed bottom-16 md:bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t px-4 py-3 flex items-center justify-between gap-4 z-20">
				<div className="text-sm">
					<p className="text-muted-foreground text-xs">{t("orders:detail.total")}</p>
					<p className="font-mono font-semibold text-lg tabular-nums">
						{total.toLocaleString("th-TH", { minimumFractionDigits: 2 })} ฿
					</p>
				</div>
				<Button
					variant="brand"
					size="lg"
					disabled={!canSubmit}
					onClick={() => mutation.mutate()}
					className="flex-1 max-w-[200px]"
				>
					{mutation.isPending ? t("common:loading") : t("common:action.save")}
				</Button>
			</div>
		</div>
	)
}
