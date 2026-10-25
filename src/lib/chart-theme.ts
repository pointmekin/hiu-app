export const BRAND_PALETTE = {
	hanko: "var(--primary)",
	ink: "var(--foreground)",
	inkSoft: "var(--chart-2)",
	inkMuted: "var(--muted-foreground)",
	bone: "var(--chart-3)",
	boneSoft: "var(--chart-4)",
	boneMuted: "var(--chart-3)",
	muted: "var(--muted)",
	mutedForeground: "var(--muted-foreground)",
} as const;

export const CHART_COLORS = [
	BRAND_PALETTE.inkMuted,
	BRAND_PALETTE.hanko,
	BRAND_PALETTE.boneMuted,
	BRAND_PALETTE.inkSoft,
] as const;

export const PAYMENT_FUNNEL_COLORS = {
	pending: BRAND_PALETTE.boneMuted,
	partial: BRAND_PALETTE.inkSoft,
	paid: BRAND_PALETTE.hanko,
} as const;

export const COLLECTION_COLORS = {
	collected: BRAND_PALETTE.hanko,
	outstanding: BRAND_PALETTE.bone,
} as const;

export const BREAKDOWN_COLORS = {
	cost: BRAND_PALETTE.inkMuted,
	margin: BRAND_PALETTE.hanko,
	shipping: BRAND_PALETTE.bone,
} as const;

export function getChartColors() {
	const root = document.documentElement;
	const style = getComputedStyle(root);

	const get = (prop: string) => style.getPropertyValue(prop).trim();

	return {
		hanko: get("--hanko"),
		ink: get("--ink"),
		inkMuted: get("--ink-muted"),
		bone: get("--bone"),
		boneMuted: get("--bone-muted"),
		mutedForeground: get("--muted-foreground"),
	};
}
