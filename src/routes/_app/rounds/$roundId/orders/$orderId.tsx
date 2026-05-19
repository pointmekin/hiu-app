import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import {
	createFileRoute,
	Link,
	useNavigate,
	useParams,
} from "@tanstack/react-router"
import { ArrowLeft, Ban, Banknote, Check, Copy, Minus, Package, Pencil, Plus, PlusCircle, Trash2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { InlineProductDialog } from "#/components/inline-product-dialog"
import { CustomerCombobox, type CustomerOption } from "#/components/customer-combobox"
import { PaymentSheet } from "#/components/payment-sheet"
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
	CommandSeparator,
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
import { cancelOrder } from "#/server/functions/orders/cancel"
import { getOrder } from "#/server/functions/orders/get"
import { updateOrder } from "#/server/functions/orders/update"
import { listRoundProducts } from "#/server/functions/round-products/list"
import { getRound } from "#/server/functions/rounds/get"
import { getSettings } from "#/server/functions/settings/get"

type EditItem = {
	roundProductId: string
	productName: string
	productBrand: string | null
	unitPriceThb: number
	quantity: number
}

export const Route = createFileRoute(
	"/_app/rounds/$roundId/orders/$orderId",
)({
	loader: async ({ context: { queryClient }, params }) => {
		await queryClient.ensureQueryData({
			queryKey: ["orders", params.orderId],
			queryFn: () => getOrder({ data: { id: params.orderId } }),
		})
	},
	component: OrderDetailPage,
})

function OrderDetailPage() {
	const { t } = useTranslation(["orders", "payments", "common"])
	const { roundId, orderId } = useParams({
		from: "/_app/rounds/$roundId/orders/$orderId",
	})
	const navigate = useNavigate()
	const queryClient = useQueryClient()

	// ── View state ──────────────────────────────────────────────────────────────
	const [paymentSheetOpen, setPaymentSheetOpen] = useState(false)

	// ── Edit state ───────────────────────────────────────────────────────────────
	const [isEditing, setIsEditing] = useState(false)
	const [editCustomerId, setEditCustomerId] = useState("")
	const [editCustomerName, setEditCustomerName] = useState("")
	const [editAddressId, setEditAddressId] = useState<string | null>(null)
	const [editItems, setEditItems] = useState<EditItem[]>([])
	const [editShippingFee, setEditShippingFee] = useState(0)
	const [editNotes, setEditNotes] = useState("")
	const [productPickerOpen, setProductPickerOpen] = useState(false)
	const [productQuery, setProductQuery] = useState("")
	const [inlineDialogOpen, setInlineDialogOpen] = useState(false)
	const [copied, setCopied] = useState(false)

	// ── Server data ───────────────────────────────────────────────────────────────
	const { data: order } = useSuspenseQuery({
		queryKey: ["orders", orderId],
		queryFn: () => getOrder({ data: { id: orderId } }),
	})

	const { data: roundProductRows = [] } = useQuery({
		queryKey: ["round-products", roundId],
		queryFn: () => listRoundProducts({ data: { roundId } }),
		enabled: isEditing,
	})

	const { data: editCustomerData } = useQuery({
		queryKey: ["customers", editCustomerId],
		queryFn: () => getCustomer({ data: { id: editCustomerId } }),
		enabled: isEditing && !!editCustomerId,
	})

	const { data: settings } = useQuery({
		queryKey: ["settings"],
		queryFn: () => getSettings(),
		enabled: isEditing,
	})

	const { data: round } = useQuery({
		queryKey: ["rounds", roundId],
		queryFn: () => getRound({ data: { id: roundId } }),
		enabled: isEditing,
	})

	const shippingPresets: number[] = settings?.shippingFeePresets ?? [39, 50, 80]

	// ── Derived ───────────────────────────────────────────────────────────────────
	const totalThb = Number(order.totalThb)
	const paidAmountThb = Number(order.paidAmountThb)
	const subtotalThb = Number(order.subtotalThb)
	const shippingFeeThb = Number(order.shippingFeeThb)
	const balance = totalThb - paidAmountThb

	const editSubtotal = editItems.reduce((s, i) => s + i.unitPriceThb * i.quantity, 0)
	const editTotal = editSubtotal + editShippingFee

	const filteredRoundProducts = roundProductRows.filter(
		(rp) =>
			!productQuery ||
			rp.productName.toLowerCase().includes(productQuery.toLowerCase()) ||
			(rp.productBrand ?? "").toLowerCase().includes(productQuery.toLowerCase()),
	)

	const isCancelled = order.status === "cancelled"
	const isPaid = order.paymentStatus === "paid"

	const paymentStatusColors: Record<string, string> = {
		pending: "text-muted-foreground",
		partial: "text-amber-600 dark:text-amber-400",
		paid: "text-green-600 dark:text-green-400",
		refunded: "text-blue-600",
	}

	// ── Edit helpers ──────────────────────────────────────────────────────────────
	function startEditing() {
		setEditCustomerId(order.customerId)
		setEditCustomerName(order.customerName)
		setEditAddressId(order.addressId ?? null)
		setEditItems(
			order.items.map((item) => ({
				roundProductId: item.roundProductId,
				productName: item.productName,
				productBrand: item.productBrand ?? null,
				unitPriceThb: Number(item.unitPriceThb),
				quantity: item.quantity,
			})),
		)
		setEditShippingFee(Number(order.shippingFeeThb))
		setEditNotes(order.notes ?? "")
		setIsEditing(true)
	}

	function discardEditing() {
		if (confirm(t("orders:action.discardEditConfirm"))) {
			setIsEditing(false)
		}
	}

	function handleEditCustomerSelect(customer: CustomerOption) {
		setEditCustomerId(customer.id)
		setEditCustomerName(customer.display_name)
		setEditAddressId(null)
	}

	function addEditItem(rp: (typeof roundProductRows)[number]) {
		setEditItems((prev) => {
			const existing = prev.find((i) => i.roundProductId === rp.id)
			if (existing) {
				return prev.map((i) =>
					i.roundProductId === rp.id ? { ...i, quantity: i.quantity + 1 } : i,
				)
			}
			return [
				...prev,
				{
					roundProductId: rp.id,
					productName: rp.productName,
					productBrand: rp.productBrand ?? null,
					unitPriceThb: Number(rp.sellPriceThb),
					quantity: 1,
				},
			]
		})
	}

	function updateEditItemQty(roundProductId: string, qty: number) {
		if (qty <= 0) {
			setEditItems((prev) => prev.filter((i) => i.roundProductId !== roundProductId))
		} else {
			setEditItems((prev) =>
				prev.map((i) => (i.roundProductId === roundProductId ? { ...i, quantity: qty } : i)),
			)
		}
	}

	function removeEditItem(roundProductId: string) {
		setEditItems((prev) => prev.filter((i) => i.roundProductId !== roundProductId))
	}

	async function copySummary() {
		const fmt = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 0 })
		const lines: string[] = ["ขออนุญาติรวมยอดค่ะ 🙏", "รายการ:"]
		order.items.forEach((item, i) => {
			lines.push(`${i + 1}. ${item.productName} ×${item.quantity}: ${fmt(Number(item.lineTotalThb))}`)
		})
		lines.push(`ค่าส่ง: ${fmt(shippingFeeThb)}`)
		lines.push(`รวมทั้งหมด: ${fmt(totalThb)}`)
		if (paidAmountThb > 0) {
			lines.push(`ชำระแล้ว: ${fmt(paidAmountThb)}`)
		}
		if (balance > 0) {
			lines.push(`คงเหลือ: ${fmt(balance)}`)
		}
		await navigator.clipboard.writeText(lines.join("\n"))
		setCopied(true)
		setTimeout(() => setCopied(false), 2000)
	}

	// ── Mutations ─────────────────────────────────────────────────────────────────
	const cancelMutation = useMutation({
		mutationFn: () => cancelOrder({ data: { id: orderId } }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["orders", orderId] })
			queryClient.invalidateQueries({ queryKey: ["orders", roundId] })
		},
	})

	const saveMutation = useMutation({
		mutationFn: () =>
			updateOrder({
				data: {
					id: orderId,
					customerId:
						editCustomerId !== order.customerId ? editCustomerId : undefined,
					addressId: editAddressId,
					shippingFeeThb: editShippingFee,
					notes: editNotes || null,
					items: editItems.map((item) => ({
						roundProductId: item.roundProductId,
						quantity: item.quantity,
						unitPriceThb: item.unitPriceThb,
					})),
				},
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["orders", orderId] })
			queryClient.invalidateQueries({ queryKey: ["orders", roundId] })
			setIsEditing(false)
		},
	})

	// ── Edit mode UI ──────────────────────────────────────────────────────────────
	if (isEditing) {
		return (
			<div className="space-y-5 pb-32">
				{/* Edit header */}
				<div className="flex items-center gap-3">
					<Button
						variant="ghost"
						size="icon"
						onClick={discardEditing}
					>
						<ArrowLeft size={18} />
					</Button>
					<span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 tracking-wide">
						{t("orders:action.editing")}
					</span>
				</div>

				{/* Customer */}
				<div className="space-y-1.5">
					<Label>{t("orders:field.customer")}</Label>
					<CustomerCombobox
						value={editCustomerId}
						customerName={editCustomerName}
						onChange={handleEditCustomerSelect}
					/>
				</div>

				{/* Address */}
				{editCustomerData && editCustomerData.addresses.length > 0 && (
					<div className="space-y-1.5">
						<Label>{t("orders:field.address")}</Label>
						<Select
							value={editAddressId ?? "none"}
							onValueChange={(v) => setEditAddressId(v === "none" ? null : v)}
						>
							<SelectTrigger>
								<SelectValue placeholder={t("orders:form.selectAddress")} />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="none">{t("orders:form.selectAddress")}</SelectItem>
								{editCustomerData.addresses.map((addr) => (
									<SelectItem key={addr.id} value={addr.id}>
										{addr.recipientName} · {addr.address.slice(0, 30)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				)}

				<Separator />

				{/* Line items */}
				<div className="space-y-1.5">
					<Label>{t("orders:detail.items")}</Label>

					{editItems.length > 0 ? (
						<div className="space-y-2">
							{editItems.map((item) => (
								<Card key={item.roundProductId} className="px-4 py-3">
									<div className="flex items-center gap-3">
										<div className="flex-1 min-w-0">
											<p className="font-medium text-sm truncate">{item.productName}</p>
											<p className="text-xs text-muted-foreground font-mono tabular-nums">
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
													updateEditItemQty(item.roundProductId, item.quantity - 1)
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
													updateEditItemQty(item.roundProductId, item.quantity + 1)
												}
											>
												<Plus size={12} />
											</Button>
											<Button
												type="button"
												variant="ghost"
												size="icon-xs"
												onClick={() => removeEditItem(item.roundProductId)}
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

					{/* Product picker */}
					<Popover open={productPickerOpen} onOpenChange={setProductPickerOpen}>
						<PopoverTrigger asChild>
							<Button
								type="button"
								variant="outline"
								className="w-full justify-start text-muted-foreground font-normal mt-1"
							>
								<Package size={16} className="mr-2" />
								{t("orders:form.addItem")}
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
										{filteredRoundProducts.map((rp) => (
											<CommandItem
												key={rp.id}
												value={rp.id}
												onSelect={() => {
													addEditItem(rp)
													setProductPickerOpen(false)
													setProductQuery("")
												}}
											>
												<div className="min-w-0 flex-1">
													<p className="font-medium truncate">{rp.productName}</p>
													{rp.productBrand && (
														<p className="text-xs text-muted-foreground">{rp.productBrand}</p>
													)}
												</div>
												<span className="font-mono text-sm ml-2 shrink-0 tabular-nums">
													{Number(rp.sellPriceThb).toLocaleString("th-TH", {
														minimumFractionDigits: 0,
													})}{" "}
													฿
												</span>
											</CommandItem>
										))}
									</CommandGroup>
									<CommandSeparator />
									<CommandGroup>
										<CommandItem
											value="__create_new__"
											onSelect={() => {
												setProductPickerOpen(false)
												setInlineDialogOpen(true)
											}}
											className="text-brand font-medium"
										>
											<PlusCircle size={14} className="shrink-0" />
											{productQuery.trim()
												? t("orders:action.createProductQuery", { name: productQuery.trim() })
												: t("orders:action.createProduct")}
										</CommandItem>
									</CommandGroup>
								</CommandList>
							</Command>
						</PopoverContent>
					</Popover>
				</div>

				<Separator />

				{/* Shipping fee */}
				<div className="space-y-2">
					<Label>{t("orders:field.shippingFee")}</Label>
					<div className="flex items-center gap-2">
						<Input
							type="number"
							step="1"
							min="0"
							value={editShippingFee}
							onChange={(e) => setEditShippingFee(Number(e.target.value))}
							className="w-28 font-mono"
						/>
						<div className="flex gap-1">
							{shippingPresets.map((preset) => (
								<Button
									key={preset}
									type="button"
									variant={editShippingFee === preset ? "brand" : "outline"}
									size="sm"
									onClick={() => setEditShippingFee(preset)}
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
						value={editNotes}
						onChange={(e) => setEditNotes(e.target.value)}
						placeholder="..."
					/>
				</div>

				{saveMutation.error && (
					<Alert variant="destructive">
						<AlertDescription>
							{(saveMutation.error as Error).message}
						</AlertDescription>
					</Alert>
				)}

				{round && (
					<InlineProductDialog
						open={inlineDialogOpen}
						onOpenChange={setInlineDialogOpen}
						roundId={roundId}
						sourceCurrency={round.sourceCurrency}
						fxRate={Number(round.fxRate)}
						perItemFeeThb={Number(round.perItemFeeTh)}
						onCreated={(rp) => {
							setEditItems((prev) => [
								...prev,
								{
									roundProductId: rp.id,
									productName: rp.productName,
									productBrand: rp.productBrand,
									unitPriceThb: Number(rp.sellPriceThb),
									quantity: 1,
								},
							])
						}}
					/>
				)}

				{/* Edit bottom bar */}
				<div className="fixed bottom-16 md:bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t px-4 py-3 flex items-center justify-between gap-3 z-20">
					<div className="text-sm">
						<p className="text-muted-foreground text-xs">{t("orders:detail.total")}</p>
						<p className="font-mono font-semibold text-lg tabular-nums">
							{editTotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })} ฿
						</p>
					</div>
					<div className="flex gap-2">
						<Button
							variant="outline"
							size="lg"
							onClick={discardEditing}
							disabled={saveMutation.isPending}
						>
							{t("orders:action.discardEdit")}
						</Button>
						<Button
							variant="brand"
							size="lg"
							disabled={editItems.length === 0 || saveMutation.isPending}
							onClick={() => saveMutation.mutate()}
						>
							{saveMutation.isPending ? t("common:loading") : t("orders:action.saveChanges")}
						</Button>
					</div>
				</div>
			</div>
		)
	}

	// ── View mode UI ──────────────────────────────────────────────────────────────
	return (
		<div className="space-y-5 pb-24">
			{/* Header */}
			<div className="flex items-center gap-3">
				<Button
					variant="ghost"
					size="icon"
					onClick={() =>
						navigate({ to: "/rounds/$roundId/orders", params: { roundId } })
					}
				>
					<ArrowLeft size={18} />
				</Button>
				<div className="min-w-0 flex-1">
					<Link
						to="/customers/$customerId"
						params={{ customerId: order.customerId }}
						className="font-semibold text-lg truncate underline-offset-2 hover:underline"
					>
						{order.customerName}
					</Link>
					<p
						className={`text-sm ${paymentStatusColors[order.paymentStatus] ?? "text-muted-foreground"}`}
					>
						{t(`orders:paymentStatus.${order.paymentStatus}`)}
						{isCancelled && (
							<span className="ml-2 text-muted-foreground">
								· {t("orders:status.cancelled")}
							</span>
						)}
					</p>
				</div>
				<Button
					variant="ghost"
					size="icon"
					onClick={copySummary}
					title={t("orders:action.copySummary")}
				>
					{copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
				</Button>
				{!isCancelled && (
					<Button variant="ghost" size="icon" onClick={startEditing} title={t("orders:action.edit")}>
						<Pencil size={16} />
					</Button>
				)}
			</div>

			{/* Line items */}
			<Card className="divide-y">
				{order.items.map((item) => (
					<div key={item.id} className="flex items-center justify-between px-4 py-3">
						<div className="min-w-0">
							<Link
								to="/products/$productId"
								params={{ productId: item.productId }}
								className="text-sm font-medium truncate underline-offset-2 hover:underline"
							>
								{item.productName}
							</Link>
							{item.productBrand && (
								<p className="text-xs text-muted-foreground">{item.productBrand}</p>
							)}
						</div>
						<div className="text-right shrink-0 ml-3">
							<p className="font-mono text-sm tabular-nums">
								{Number(item.lineTotalThb).toLocaleString("th-TH", {
									minimumFractionDigits: 0,
								})}{" "}
								฿
							</p>
							<p className="text-xs text-muted-foreground font-mono tabular-nums">
								{Number(item.unitPriceThb).toLocaleString("th-TH", {
									minimumFractionDigits: 0,
								})}{" "}
								× {item.quantity}
							</p>
						</div>
					</div>
				))}
			</Card>

			{/* Totals */}
			<Card className="px-4 py-3 space-y-2">
				<div className="flex justify-between text-sm">
					<span className="text-muted-foreground">{t("orders:detail.subtotal")}</span>
					<span className="font-mono tabular-nums">
						{subtotalThb.toLocaleString("th-TH", { minimumFractionDigits: 2 })} ฿
					</span>
				</div>
				<div className="flex justify-between text-sm">
					<span className="text-muted-foreground">{t("orders:detail.shipping")}</span>
					<span className="font-mono tabular-nums">
						{shippingFeeThb.toLocaleString("th-TH", { minimumFractionDigits: 2 })} ฿
					</span>
				</div>
				<Separator />
				<div className="flex justify-between font-semibold">
					<span>{t("orders:detail.total")}</span>
					<span className="font-mono tabular-nums">
						{totalThb.toLocaleString("th-TH", { minimumFractionDigits: 2 })} ฿
					</span>
				</div>
				<div className="flex justify-between text-sm text-green-600 dark:text-green-400">
					<span>{t("orders:detail.paid")}</span>
					<span className="font-mono tabular-nums">
						{paidAmountThb.toLocaleString("th-TH", { minimumFractionDigits: 2 })} ฿
					</span>
				</div>
				{balance > 0 && (
					<div className="flex justify-between text-sm font-medium text-amber-600 dark:text-amber-400">
						<span>{t("orders:detail.balance")}</span>
						<span className="font-mono tabular-nums">
							{balance.toLocaleString("th-TH", { minimumFractionDigits: 2 })} ฿
						</span>
					</div>
				)}
			</Card>

			{/* Address */}
			{order.address && (
				<Card className="px-4 py-3">
					<p className="text-xs text-muted-foreground mb-1">{t("orders:field.address")}</p>
					<p className="text-sm font-medium">{order.address.recipientName}</p>
					<p className="text-sm text-muted-foreground">{order.address.mobile}</p>
					<p className="text-sm text-muted-foreground">{order.address.address}</p>
					<p className="text-sm text-muted-foreground">{order.address.postalCode}</p>
				</Card>
			)}

			{/* Payment history */}
			{order.payments.length > 0 && (
				<div>
					<p className="text-sm font-medium mb-2">{t("payments:history.title")}</p>
					<Card className="divide-y">
						{order.payments.map((payment) => (
							<div key={payment.id} className="flex items-center justify-between px-4 py-3">
								<div>
									<p className="text-sm font-medium">
										{t(`payments:type.${payment.type}`)}
									</p>
									<p className="text-xs text-muted-foreground">
										{payment.method ? t(`payments:method.${payment.method}`) : ""}
										{payment.notes ? ` · ${payment.notes}` : ""}
									</p>
								</div>
								<span className="font-mono text-sm tabular-nums">
									{Number(payment.amountThb).toLocaleString("th-TH", {
										minimumFractionDigits: 2,
									})}{" "}
									฿
								</span>
							</div>
						))}
					</Card>
				</div>
			)}

			{/* Notes */}
			{order.notes && (
				<Card className="px-4 py-3">
					<p className="text-xs text-muted-foreground mb-1">{t("orders:detail.notes")}</p>
					<p className="text-sm">{order.notes}</p>
				</Card>
			)}

			{cancelMutation.error && (
				<Alert variant="destructive">
					<AlertDescription>
						{(cancelMutation.error as Error).message}
					</AlertDescription>
				</Alert>
			)}

			{/* View-mode action bar */}
			{!isCancelled && (
				<div className="fixed bottom-16 md:bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t px-4 py-3 flex gap-3 z-20">
					{!isPaid && (
						<Button
							variant="brand"
							size="lg"
							className="flex-1"
							onClick={() => setPaymentSheetOpen(true)}
						>
							<Banknote size={18} />
							{t("orders:action.recordPayment")}
						</Button>
					)}
					<Button
						variant="outline"
						size="lg"
						onClick={() => {
							if (confirm(t("orders:action.cancelConfirm"))) {
								cancelMutation.mutate()
							}
						}}
						disabled={cancelMutation.isPending}
						className={isPaid ? "flex-1" : ""}
					>
						<Ban size={18} />
						{t("orders:action.cancel")}
					</Button>
				</div>
			)}

			<PaymentSheet
				open={paymentSheetOpen}
				onOpenChange={setPaymentSheetOpen}
				orderId={orderId}
				orderNumber={order.customerName}
				totalThb={totalThb}
				paidAmountThb={paidAmountThb}
			/>
		</div>
	)
}
