export function formatRelativeDate(
	date: Date | string | null | undefined,
	locale = "th",
): string | null {
	if (date == null) return null;
	const d = typeof date === "string" ? new Date(date) : date;
	if (Number.isNaN(d.getTime())) return null;

	const diffMs = Date.now() - d.getTime();
	const diffDays = Math.floor(diffMs / 86_400_000);

	const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
	if (diffDays < 1) return rtf.format(0, "day");
	if (diffDays < 7) return rtf.format(-diffDays, "day");
	if (diffDays < 30) return rtf.format(-Math.floor(diffDays / 7), "week");
	if (diffDays < 365) return rtf.format(-Math.floor(diffDays / 30), "month");
	return rtf.format(-Math.floor(diffDays / 365), "year");
}
