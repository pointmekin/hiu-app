const BRAND_PALETTE = {
	hanko: "var(--hanko)",
	ink: "var(--ink)",
	inkSoft: "var(--ink-soft)",
	inkMuted: "var(--ink-muted)",
	bone: "var(--bone)",
	boneSoft: "var(--bone-soft)",
	boneMuted: "var(--bone-muted)",
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
