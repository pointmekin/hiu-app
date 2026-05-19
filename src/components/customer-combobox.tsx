import { useQuery } from "@tanstack/react-query"
import { Check, ChevronsUpDown, UserPlus } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { searchCustomers } from "#/server/functions/customers/search"
import { useDebounce } from "#/lib/use-debounce"
import { cn } from "#/lib/utils"
import { Button } from "#/components/ui/button"
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
} from "#/components/ui/command"
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog"
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "#/components/ui/popover"
import { CustomerForm } from "#/components/customer-form"

export interface CustomerOption {
	id: string
	display_name: string
	phone: string | null
	line_id: string | null
	last_ordered_at: string | null
}

interface CustomerComboboxProps {
	value: string | null
	customerName: string | null
	onChange: (customer: CustomerOption) => void
	className?: string
	disabled?: boolean
}

export function CustomerCombobox({
	value,
	customerName,
	onChange,
	className,
	disabled,
}: CustomerComboboxProps) {
	const { t } = useTranslation("customers")
	const [open, setOpen] = useState(false)
	const [newDialogOpen, setNewDialogOpen] = useState(false)
	const [query, setQuery] = useState("")
	const debouncedQuery = useDebounce(query, 200)

	const { data: results = [] } = useQuery({
		queryKey: ["customers", "search", debouncedQuery],
		queryFn: () => searchCustomers({ data: { query: debouncedQuery, limit: 8 } }),
	})

	function handleSelect(customer: CustomerOption) {
		onChange(customer)
		setOpen(false)
	}

	function handleNewCustomerCreated(id: string, displayName: string) {
		onChange({ id, display_name: displayName, phone: null, line_id: null, last_ordered_at: null })
		setNewDialogOpen(false)
	}

	return (
		<>
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<Button
						variant="outline"
						role="combobox"
						aria-expanded={open}
						disabled={disabled}
						className={cn("w-full justify-between font-normal", className)}
					>
						<span className={cn("truncate", !value && "text-muted-foreground")}>
							{value ? customerName ?? value : t("form.selectCustomer")}
						</span>
						<ChevronsUpDown className="ml-2 shrink-0 opacity-50 size-4" />
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-[300px] p-0" align="start">
					<Command shouldFilter={false}>
						<CommandInput
							placeholder={t("list.search")}
							value={query}
							onValueChange={setQuery}
						/>
						<CommandList>
							<CommandEmpty>{t("list.empty")}</CommandEmpty>
							<CommandGroup>
								{results.map((c) => (
									<CommandItem
										key={c.id}
										value={c.id}
										onSelect={() => handleSelect(c)}
										className="flex items-center gap-2"
									>
										<Check
											className={cn(
												"size-4 shrink-0",
												value === c.id ? "opacity-100" : "opacity-0",
											)}
										/>
										<div className="min-w-0">
											<p className="font-medium truncate">{c.display_name}</p>
											{c.phone && (
												<p className="text-xs text-muted-foreground">{c.phone}</p>
											)}
										</div>
									</CommandItem>
								))}
							</CommandGroup>
							<CommandSeparator />
							<CommandGroup>
								<CommandItem
									onSelect={() => {
										setOpen(false)
										setNewDialogOpen(true)
									}}
									className="text-muted-foreground"
								>
									<UserPlus className="size-4" />
									{t("action.new")}
								</CommandItem>
							</CommandGroup>
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>

			<Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t("form.createTitle")}</DialogTitle>
					</DialogHeader>
					<CustomerForm onSuccess={handleNewCustomerCreated} />
				</DialogContent>
			</Dialog>
		</>
	)
}
