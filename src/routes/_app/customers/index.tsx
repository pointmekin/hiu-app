import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { Plus, Users } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { CustomerForm } from "#/components/customer-form"
import { EmptyState } from "#/components/empty-state"
import { Button } from "#/components/ui/button"
import { Card } from "#/components/ui/card"
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog"
import { Input } from "#/components/ui/input"
import { useDebounce } from "#/lib/use-debounce"
import { searchCustomers } from "#/server/functions/customers/search"

export const Route = createFileRoute("/_app/customers/")({
	component: CustomersPage,
})

function CustomersPage() {
	const { t } = useTranslation("customers")
	const [query, setQuery] = useState("")
	const debouncedQuery = useDebounce(query, 200)
	const [createOpen, setCreateOpen] = useState(false)
	const navigate = useNavigate()
	const queryClient = useQueryClient()

	const { data: customers = [] } = useQuery({
		queryKey: ["customers", "search", debouncedQuery],
		queryFn: () => searchCustomers({ data: { query: debouncedQuery, limit: 20 } }),
	})

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

			{customers.length === 0 ? (
				<EmptyState
					icon={<Users size={32} className="text-ink-muted" />}
					title={t("list.empty")}
					hint={t("list.emptyHint")}
				/>
			) : (
				<ul className="space-y-2">
					{customers.map((c) => (
						<li key={c.id}>
							<Link to="/customers/$customerId" params={{ customerId: c.id }}>
								<Card className="flex items-start justify-between px-4 py-3 hover:bg-accent/50 transition-colors">
									<div>
										<p className="font-medium">{c.display_name}</p>
										{c.phone && (
											<p className="text-sm text-muted-foreground">{c.phone}</p>
										)}
									</div>
									{c.last_ordered_at && (
										<p className="text-xs text-muted-foreground">
											{new Date(c.last_ordered_at).toLocaleDateString("th-TH")}
										</p>
									)}
								</Card>
							</Link>
						</li>
					))}
				</ul>
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
