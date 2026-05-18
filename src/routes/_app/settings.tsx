import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { getSettings } from "#/server/functions/settings/get"
import { updateSettings } from "#/server/functions/settings/update"
import type { AppSettings } from "#/shared/schemas/settings"
import { Alert, AlertDescription } from "#/components/ui/alert"
import { Button } from "#/components/ui/button"
import { Input } from "#/components/ui/input"
import { Label } from "#/components/ui/label"

export const Route = createFileRoute("/_app/settings")({
	loader: async ({ context: { queryClient } }) => {
		await queryClient.ensureQueryData({
			queryKey: ["settings"],
			queryFn: () => getSettings(),
		})
	},
	component: SettingsPage,
})

function SettingsPage() {
	const { t } = useTranslation(["settings", "common"])
	const queryClient = useQueryClient()

	const { data: settings } = useSuspenseQuery({
		queryKey: ["settings"],
		queryFn: () => getSettings(),
	})

	const [presetsInput, setPresetsInput] = useState(
		settings.shippingFeePresets.join(", "),
	)
	const [defaultFee, setDefaultFee] = useState(
		String(settings.defaultShippingFee),
	)
	const [currencies, setCurrencies] = useState(
		settings.sourceCurrencies.join(", "),
	)

	const mutation = useMutation({
		mutationFn: (data: Partial<AppSettings>) => updateSettings({ data }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["settings"] })
		},
	})

	function handleSave() {
		const shippingFeePresets = presetsInput
			.split(",")
			.map((s) => Number(s.trim()))
			.filter((n) => !Number.isNaN(n) && n > 0)

		const sourceCurrencies = currencies
			.split(",")
			.map((s) => s.trim().toUpperCase())
			.filter(Boolean)

		mutation.mutate({
			shippingFeePresets,
			defaultShippingFee: Number(defaultFee),
			sourceCurrencies,
		})
	}

	return (
		<div className="max-w-xl mx-auto px-4 py-6">
			<h1 className="text-2xl font-semibold text-foreground mb-6">
				{t("settings:title")}
			</h1>

			<section className="space-y-5">
				<h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
					{t("settings:section.shipping")}
				</h2>

				<div className="space-y-1.5">
					<Label>{t("settings:field.shippingFeePresets")}</Label>
					<Input
						type="text"
						value={presetsInput}
						onChange={(e) => setPresetsInput(e.target.value)}
					/>
					<p className="text-xs text-muted-foreground">{t("settings:presetsHint")}</p>
				</div>

				<div className="space-y-1.5">
					<Label>{t("settings:field.defaultShippingFee")}</Label>
					<Input
						type="number"
						value={defaultFee}
						onChange={(e) => setDefaultFee(e.target.value)}
						step="1"
						min="0"
						className="font-mono"
					/>
				</div>

				<h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide pt-4">
					{t("settings:section.currencies")}
				</h2>

				<div className="space-y-1.5">
					<Label>{t("settings:field.sourceCurrencies")}</Label>
					<Input
						type="text"
						value={currencies}
						onChange={(e) => setCurrencies(e.target.value)}
						placeholder="JPY, USD, GBP, HKD, AUD"
					/>
				</div>

				{mutation.error && (
					<Alert variant="destructive">
						<AlertDescription>
							{(mutation.error as Error).message}
						</AlertDescription>
					</Alert>
				)}
				{mutation.isSuccess && (
					<Alert>
						<AlertDescription>{t("settings:saved")} ✓</AlertDescription>
					</Alert>
				)}

				<Button
					type="button"
					variant="brand"
					onClick={handleSave}
					disabled={mutation.isPending}
				>
					{mutation.isPending ? t("common:loading") : t("common:action.save")}
				</Button>
			</section>
		</div>
	)
}
