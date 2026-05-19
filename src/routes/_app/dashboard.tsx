import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_app/dashboard")({
	component: DashboardLayout,
});

function DashboardLayout() {
	const { t } = useTranslation("dashboard");

	return (
		<div className="p-4 md:p-6 max-w-6xl mx-auto">
			<h1 className="font-display text-2xl font-semibold mb-6">
				{t("title")}
			</h1>
			<nav className="flex gap-4 mb-6 border-b border-border pb-3">
				<NavLink to="/dashboard">{t("crossRound.title")}</NavLink>
				<NavLink to="/dashboard/audit">{t("audit.title")}</NavLink>
			</nav>
			<Outlet />
		</div>
	);
}

function NavLink({
	to,
	children,
}: {
	to: string;
	children: React.ReactNode;
}) {
	return (
		<Link
			to={to}
			className="text-sm text-muted-foreground hover:text-foreground transition-colors"
			activeProps={{ className: "text-foreground font-medium" }}
		>
			{children}
		</Link>
	);
}
