import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import {
	createFileRoute,
	useNavigate,
	useParams,
} from "@tanstack/react-router"
import { ArrowLeft, Banknote, Ban } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { PaymentSheet } from "#/components/payment-sheet"
import { Alert, AlertDescription } from "#/components/ui/alert"
import { Button } from "#/components/ui/button"
import { Card } from "#/components/ui/card"
import { Separator } from "#/components/ui/separator"
import { cancelOrder } from "#/server/functions/orders/cancel"
import { getOrder } from "#/server/functions/orders/get"

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
	const [paymentSheetOpen, setPaymentSheetOpen] = useState(false)

	const { data: order } = useSuspenseQuery({
		queryKey: ["orders", orderId],
		queryFn: () => getOrder({ data: { id: orderId } }),
	})

	const cancelMutation = useMutation({
		mutationFn: () => cancelOrder({ data: { id: orderId } }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["orders", orderId] })
			queryClient.invalidateQueries({ queryKey: ["orders", roundId] })
		},
	})

	const totalThb = Number(order.totalThb)
	const paidAmountThb = Number(order.paidAmountThb)
	const subtotalThb = Number(order.subtotalThb)
	const shippingFeeThb = Number(order.shippingFeeThb)
	const balance = totalThb - paidAmountThb

	const paymentStatusColors: Record<string, string> = {
		pending: "text-muted-foreground",
		partial: "text-amber-600 dark:text-amber-400",
		paid: "text-green-600 dark:text-green-400",
		refunded: "text-blue-600",
	}

	const isCancelled = order.status === "cancelled"
	const isPaid = order.paymentStatus === "paid"

	return (
		<div className="space-y-5 pb-24">
			{/* Back + header */}
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
				<div className="min-w-0">
					<h2 className="font-semibold text-lg truncate">{order.customerName}</h2>
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
			</div>

			{/* Line items */}
			<Card className="divide-y">
				{order.items.map((item) => (
					<div key={item.id} className="flex items-center justify-between px-4 py-3">
						<div className="min-w-0">
							<p className="text-sm font-medium truncate">{item.productName}</p>
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
							<p className="text-xs text-muted-foreground font-mono">
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

			{/* Action buttons */}
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
