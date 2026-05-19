import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ShippingSkeleton } from "#/components/round-skeletons";
import { Button } from "#/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "#/components/ui/table";
import { getCustomersMissingAddress } from "#/server/functions/exports/get-customers-missing-address";
import { getKerryRows } from "#/server/functions/exports/get-kerry-rows";

export const Route = createFileRoute("/_app/rounds/$roundId/shipping")({
	loader: async ({ context: { queryClient }, params }) => {
		const promises = Promise.all([
			queryClient.ensureQueryData({
				queryKey: ["kerry", params.roundId],
				queryFn: () => getKerryRows({ data: { roundId: params.roundId } }),
			}),
			queryClient.ensureQueryData({
				queryKey: ["customers-missing-address", params.roundId],
				queryFn: () =>
					getCustomersMissingAddress({ data: { roundId: params.roundId } }),
			}),
		]);
		if (typeof window === "undefined") {
			await promises;
		}
	},
	pendingComponent: ShippingSkeleton,
	component: ShippingPage,
});

function ShippingPage() {
	const { t } = useTranslation(["exports", "common"]);
	const { roundId } = useParams({ from: "/_app/rounds/$roundId/shipping" });

	const { data: rows } = useSuspenseQuery({
		queryKey: ["kerry", roundId],
		queryFn: () => getKerryRows({ data: { roundId } }),
		refetchOnMount: "always",
	});

	const { data: missingAddressCustomers } = useSuspenseQuery({
		queryKey: ["customers-missing-address", roundId],
		queryFn: () => getCustomersMissingAddress({ data: { roundId } }),
		refetchOnMount: "always",
	});

	return (
		<div className="space-y-6">
			{missingAddressCustomers.length > 0 && (
				<Card className="border-destructive/50">
					<CardHeader>
						<CardTitle className="text-destructive">
							{t("exports:kerry.missingAddress.title")}
						</CardTitle>
						<CardDescription>
							{t("exports:kerry.missingAddress.description")}
						</CardDescription>
					</CardHeader>
					<CardContent>
						<ul className="space-y-1">
							{missingAddressCustomers.map((c) => (
								<li key={c.customerId} className="text-sm">
									<Link
										to="/customers/$customerId"
										params={{ customerId: c.customerId }}
										className="underline underline-offset-2 hover:text-foreground"
									>
										{c.customerName}
									</Link>
								</li>
							))}
						</ul>
					</CardContent>
				</Card>
			)}

			<Card>
				<CardHeader>
					<CardTitle>{t("exports:kerry.title")}</CardTitle>
					<CardDescription>
						{t("exports:kerry.description")}
						{" — "}
						{t("exports:kerry.filterHint")}
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<Button asChild variant="default">
						<a href={`/api/exports/kerry/${roundId}`} download>
							{t("exports:kerry.download")}
						</a>
					</Button>

					{rows.length === 0 ? (
						<p className="text-sm text-muted-foreground py-4">
							{t("exports:kerry.empty")}
						</p>
					) : (
						<div className="overflow-x-auto">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead className="w-12">No</TableHead>
										<TableHead>{t("exports:kerry.col.recipient")}</TableHead>
										<TableHead>{t("exports:kerry.col.mobile")}</TableHead>
										<TableHead>{t("exports:kerry.col.address")}</TableHead>
										<TableHead>{t("exports:kerry.col.postalCode")}</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{rows.map((row) => (
										<TableRow key={row.no}>
											<TableCell className="font-mono">{row.no}</TableCell>
											<TableCell>
												<div className="flex items-center gap-2">
													<span>
														{row.recipientName || t("exports:kerry.noAddress")}
													</span>
													{row.paymentStatus === "pending" && (
														<span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full font-medium">
															{t("exports:kerry.unpaidBadge")}
														</span>
													)}
												</div>
											</TableCell>
											<TableCell className="font-mono">{row.mobile}</TableCell>
											<TableCell>{row.address}</TableCell>
											<TableCell className="font-mono">
												{row.postalCode}
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
