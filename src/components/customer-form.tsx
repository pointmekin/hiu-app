import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type Resolver, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "#/components/ui/form";
import { Input } from "#/components/ui/input";
import { Separator } from "#/components/ui/separator";
import { Textarea } from "#/components/ui/textarea";
import { upsertCustomer } from "#/server/functions/customers/upsert";
import {
	type UpsertCustomerInput,
	upsertCustomerSchema,
} from "#/shared/schemas/customer";

interface CustomerFormProps {
	initialValues?: Partial<UpsertCustomerInput>;
	onSuccess?: (id: string, displayName: string) => void;
	withAddress?: boolean;
	addressOnly?: boolean;
}

export function CustomerForm({
	initialValues,
	onSuccess,
	withAddress = true,
	addressOnly = false,
}: CustomerFormProps) {
	const { t } = useTranslation("customers");
	const { t: tc } = useTranslation("common");
	const queryClient = useQueryClient();

	const form = useForm<UpsertCustomerInput>({
		resolver: zodResolver(
			upsertCustomerSchema,
		) as Resolver<UpsertCustomerInput>,
		defaultValues: {
			displayName: "",
			lineId: "",
			instagramHandle: "",
			phone: "",
			notes: "",
			...initialValues,
			address: withAddress
				? {
						recipientName: "",
						mobile: "",
						address: "",
						postalCode: "",
						isDefault: true,
						...initialValues?.address,
					}
				: undefined,
		},
	});

	const mutation = useMutation({
		mutationFn: (data: UpsertCustomerInput) => upsertCustomer({ data }),
		onSuccess: (result) => {
			queryClient.invalidateQueries({ queryKey: ["customers"] });
			const name = form.getValues("displayName");
			onSuccess?.(result.id, name);
		},
	});

	function onSubmit(data: UpsertCustomerInput) {
		mutation.mutate(data);
	}

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
				{!addressOnly && (
					<>
						<FormField
							control={form.control}
							name="displayName"
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t("field.displayName")}</FormLabel>
									<FormControl>
										<Input {...field} autoFocus />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<div className="grid grid-cols-2 gap-3">
							<FormField
								control={form.control}
								name="phone"
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t("field.phone")}</FormLabel>
										<FormControl>
											<Input {...field} type="tel" inputMode="tel" />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="lineId"
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t("field.lineId")}</FormLabel>
										<FormControl>
											<Input {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<FormField
							control={form.control}
							name="notes"
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t("field.notes")}</FormLabel>
									<FormControl>
										<Textarea {...field} rows={2} className="resize-none" />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
					</>
				)}

				{(withAddress || addressOnly) && (
					<>
						{!addressOnly && <Separator />}
						{!addressOnly && (
							<p className="text-sm font-medium">{t("form.addressSection")}</p>
						)}

						<FormField
							control={form.control}
							name="address.recipientName"
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t("field.recipientName")}</FormLabel>
									<FormControl>
										<Input {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="address.mobile"
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t("field.mobile")}</FormLabel>
									<FormControl>
										<Input {...field} type="tel" inputMode="tel" />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="address.address"
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t("field.address")}</FormLabel>
									<FormControl>
										<Textarea {...field} rows={2} className="resize-none" />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="address.postalCode"
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t("field.postalCode")}</FormLabel>
									<FormControl>
										<Input {...field} inputMode="numeric" maxLength={5} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
					</>
				)}

				{mutation.error && (
					<Alert variant="destructive">
						<AlertDescription>
							{(mutation.error as Error).message}
						</AlertDescription>
					</Alert>
				)}

				<Button
					type="submit"
					variant="default"
					disabled={mutation.isPending}
					className="w-full"
				>
					{mutation.isPending ? tc("loading") : tc("action.save")}
				</Button>
			</form>
		</Form>
	);
}
