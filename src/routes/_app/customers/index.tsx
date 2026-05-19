import { keepPreviousData, useInfiniteQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { Plus, Users } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { CustomerForm } from "#/components/customer-form"
import { EmptyState } from "#/components/empty-state"
import { Badge } from "#/components/ui/badge"
import { Button } from "#/components/ui/button"
import { Card } from "#/components/ui/card"
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog"
import { Input } from "#/components/ui/input"
import { formatRelativeDate } from "#/lib/format-relative"
import { useDebounce } from "#/lib/use-debounce"
import type { CustomerListCursor } from "#/server/functions/customers/list"
import { listCustomers } from "#/server/functions/customers/list"

const PAGE_SIZE = 20

export const Route = createFileRoute("/_app/customers/")({
	component: CustomersPage,
})

type CustomerItem = {
	id: string
	displayName: string
	phone: string | null
	lineId: string | null
	instagramHandle: string | null
	lastOrderedAt: string | null
	orderCount: number
}

function CustomersPage() {
	const { t, i18n } = useTranslation("customers")
	const [query, setQuery] = useState("")
	const debouncedQuery = useDebounce(query, 200)
	const [createOpen, setCreateOpen] = useState(false)
	const navigate = useNavigate()
	const queryClient = useQueryClient()

	const listQuery = useInfiniteQuery({
		queryKey: ["customers", "list", debouncedQuery],
		queryFn: ({ pageParam }: { pageParam: CustomerListCursor | null }) =>
			listCustomers({
				data: { q: debouncedQuery, limit: PAGE_SIZE, cursor: pageParam ?? undefined },
			}),
		initialPageParam: null as CustomerListCursor | null,
		getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
		placeholderData: keepPreviousData,
	})

	const customers = listQuery.data?.pages.flatMap((p) => p.items) ?? []

	return (
		<div className="max-w-2xl mx-auto px-4 py-6">
			<div className="flex items-center justify-between mb-4">
				<h1 className="text-2xl font-semibold">{t("list.title")}</h1>
				<Button variant="brand" size="sm" onClick={() => setCreateOpen(true)}>
					<Plus size={16} />
					{t("action.new")}
				</Button>
			</div>

			<Input
				placeholder={t("list.search")}
				value={query}
				onChange={(e) => setQuery(e.target.value)}
				className="mb-4"
			/>

			{customers.length === 0 && !listQuery.isFetching ? (
				<EmptyState
					icon={<Users size={32} className="text-ink-muted" />}
					title={t("list.empty")}
					hint={t("list.emptyHint")}
				/>
			) : (
				<>
					<ul className="space-y-2">
						{customers.map((c) => (
							<li key={c.id}>
								<Link
									to="/customers/$customerId"
									params={{ customerId: c.id }}
									className="block"
								>
									<CustomerCard customer={c} locale={i18n.language} t={t} />
								</Link>
							</li>
						))}
					</ul>

					{listQuery.hasNextPage && (
						<div className="mt-6 flex justify-center">
							<Button
								variant="outline"
								size="sm"
								onClick={() => listQuery.fetchNextPage()}
								disabled={listQuery.isFetchingNextPage}
							>
								{listQuery.isFetchingNextPage
									? t("common:loading")
									: t("list.loadMore")}
							</Button>
						</div>
					)}
				</>
			)}

			<Dialog open={createOpen} onOpenChange={setCreateOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t("form.createTitle")}</DialogTitle>
					</DialogHeader>
					<CustomerForm
						withAddress
						onSuccess={(id) => {
							queryClient.invalidateQueries({ queryKey: ["customers"] })
							setCreateOpen(false)
							navigate({ to: "/customers/$customerId", params: { customerId: id } })
						}}
					/>
				</DialogContent>
			</Dialog>
		</div>
	)
}

interface CustomerCardProps {
	customer: CustomerItem
	locale: string
	t: ReturnType<typeof useTranslation<"customers">>["t"]
}

function CustomerCard({ customer, locale, t }: CustomerCardProps) {
	const contactHandle = customer.lineId
		? `LINE: ${customer.lineId}`
		: customer.instagramHandle
			? `IG: ${customer.instagramHandle}`
			: null

	const relDate = formatRelativeDate(customer.lastOrderedAt, locale)

	const secondaryParts = [customer.phone, contactHandle, relDate].filter(Boolean)
	const secondaryLine = secondaryParts.join(" · ")

	return (
		<Card className="flex flex-row items-start gap-3 px-4 py-3 hover:bg-accent/50 transition-colors min-h-[56px]">
			<div className="flex-1 min-w-0">
				<p className="font-semibold text-foreground leading-tight">
					{customer.displayName}
				</p>
				{secondaryLine && (
					<p className="text-xs text-muted-foreground mt-0.5 truncate">
						{secondaryLine}
					</p>
				)}
			</div>

			{customer.orderCount > 0 && (
				<Badge variant="secondary" className="shrink-0 tabular-nums text-xs mt-0.5">
					{t("list.orders", { count: customer.orderCount })}
				</Badge>
			)}
		</Card>
	)
}
