import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	useNavigate,
	useParams,
} from "@tanstack/react-router";
import { ArrowLeft, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CustomerForm } from "#/components/customer-form";
import { CustomerDetailSkeleton } from "#/components/round-skeletons";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { Separator } from "#/components/ui/separator";
import { getCustomer } from "#/server/functions/customers/get";
import type { UpsertCustomerInput } from "#/shared/schemas/customer";

export const Route = createFileRoute("/_app/customers/$customerId")({
	loader: async ({ context: { queryClient }, params }) => {
		const promise = queryClient.ensureQueryData({
			queryKey: ["customers", params.customerId],
			queryFn: () => getCustomer({ data: { id: params.customerId } }),
		});
		if (typeof window === "undefined") {
			await promise;
		}
	},
	pendingComponent: CustomerDetailSkeleton,
	component: CustomerDetailPage,
});

function CustomerDetailPage() {
	const { t } = useTranslation(["customers", "common"]);
	const { customerId } = useParams({ from: "/_app/customers/$customerId" });
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [addAddressOpen, setAddAddressOpen] = useState(false);
	const [editingAddressId, setEditingAddressId] = useState<string | null>(null);

	const { data: customer } = useSuspenseQuery({
		queryKey: ["customers", customerId],
		queryFn: () => getCustomer({ data: { id: customerId } }),
	});

	const initialValues: Partial<UpsertCustomerInput> = {
		id: customer.id,
		displayName: customer.displayName,
		lineId: customer.lineId ?? undefined,
		instagramHandle: customer.instagramHandle ?? undefined,
		phone: customer.phone ?? undefined,
		notes: customer.notes ?? undefined,
	};

	return (
		<div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
			<div className="flex items-center gap-3">
				<Button
					variant="ghost"
					size="icon"
					onClick={() => navigate({ to: "/customers" })}
				>
					<ArrowLeft size={18} />
				</Button>
				<h1 className="text-xl font-semibold">{customer.displayName}</h1>
			</div>

			<div className="md:flex md:gap-8 md:items-start">
				<div className="md:flex-1 md:min-w-0">
					<CustomerForm initialValues={initialValues} withAddress={false} />
				</div>

				<div className="md:w-80 md:shrink-0">
					<Separator className="md:hidden my-6" />

					{/* Addresses */}
					<div>
						<div className="flex items-center justify-between mb-3">
							<p className="font-medium">
								{t("customers:form.addressSection")}
							</p>
							<Button
								variant="outline"
								size="sm"
								onClick={() => setAddAddressOpen(true)}
							>
								<Plus size={14} />
								{t("customers:form.addAddress")}
							</Button>
						</div>

						{customer.addresses.length === 0 ? (
							<p className="text-sm text-muted-foreground">
								{t("customers:form.noAddress")}
							</p>
						) : (
							<div className="space-y-2">
								{customer.addresses.map((addr) => (
									<Card key={addr.id} className="px-4 py-3">
										<div className="flex items-start justify-between gap-2">
											<div className="min-w-0">
												<p className="font-medium text-sm">
													{addr.recipientName}
												</p>
												<p className="text-sm text-muted-foreground">
													{addr.mobile}
												</p>
												<p className="text-sm text-muted-foreground">
													{addr.address}
												</p>
												<p className="text-sm text-muted-foreground">
													{addr.postalCode}
												</p>
											</div>
											<div className="flex items-center gap-2 shrink-0">
												{addr.isDefault && (
													<span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
														{t("customers:field.isDefault")}
													</span>
												)}
												<Button
													variant="ghost"
													size="icon-xs"
													onClick={() => setEditingAddressId(addr.id)}
												>
													<Pencil size={13} />
												</Button>
											</div>
										</div>
									</Card>
								))}
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Add address dialog */}
			<Dialog open={addAddressOpen} onOpenChange={setAddAddressOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t("customers:form.newAddress")}</DialogTitle>
					</DialogHeader>
					<CustomerForm
						initialValues={{
							id: customerId,
							displayName: customer.displayName,
							address: {
								recipientName: "",
								mobile: customer.phone ?? "",
								address: "",
								postalCode: "",
								isDefault: customer.addresses.length === 0,
							},
						}}
						addressOnly
						onSuccess={() => {
							queryClient.invalidateQueries({
								queryKey: ["customers", customerId],
							});
							setAddAddressOpen(false);
						}}
					/>
				</DialogContent>
			</Dialog>

			{/* Edit address dialog */}
			{customer.addresses.map((addr) => (
				<Dialog
					key={addr.id}
					open={editingAddressId === addr.id}
					onOpenChange={(open) => !open && setEditingAddressId(null)}
				>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>{t("customers:form.addressSection")}</DialogTitle>
						</DialogHeader>
						<CustomerForm
							initialValues={{
								id: customerId,
								displayName: customer.displayName,
								address: {
									id: addr.id,
									recipientName: addr.recipientName,
									mobile: addr.mobile,
									address: addr.address,
									postalCode: addr.postalCode,
									isDefault: addr.isDefault,
								},
							}}
							addressOnly
							onSuccess={() => {
								queryClient.invalidateQueries({
									queryKey: ["customers", customerId],
								});
								setEditingAddressId(null);
							}}
						/>
					</DialogContent>
				</Dialog>
			))}
		</div>
	);
}
