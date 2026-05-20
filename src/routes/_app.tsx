import {
	createFileRoute,
	Link,
	Outlet,
	redirect,
} from "@tanstack/react-router";
import {
	BarChart3,
	Globe,
	LogOut,
	Menu,
	Moon,
	Package,
	Settings,
	ShoppingBag,
	Sun,
	Users,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PageProgressBar } from "#/components/page-progress-bar";
import { Button } from "#/components/ui/button";
import { Separator } from "#/components/ui/separator";
import {
	Sheet,
	SheetBody,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "#/components/ui/sheet";
import { useDarkMode } from "#/hooks/use-dark-mode";
import {
	ShortcutHelpOverlay,
	useKeyboardShortcuts,
} from "#/hooks/use-keyboard-shortcuts.tsx";
import { authClient } from "#/lib/auth-client";
import i18n, { type Locale } from "#/lib/i18n";

export const Route = createFileRoute("/_app")({
	beforeLoad: ({ context }) => {
		if (!context.session) {
			throw redirect({ to: "/login" });
		}
	},
	component: AppLayout,
});

function AppLayout() {
	const { t } = useTranslation("common");
	const { showHelp, setShowHelp } = useKeyboardShortcuts();
	const { isDark, toggle: toggleDark } = useDarkMode();
	const [moreOpen, setMoreOpen] = useState(false);

	async function handleLogout() {
		await authClient.signOut();
		window.location.href = "/login";
	}

	function handleLocaleChange(locale: Locale) {
		i18n.changeLanguage(locale);
		// biome-ignore lint/suspicious/noDocumentCookie: locale cookie has no sensitive data; Cookie Store API support is limited
		document.cookie = `locale=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
	}

	return (
		<div className="flex flex-col min-h-dvh bg-background">
			<PageProgressBar />
			<ShortcutHelpOverlay
				showHelp={showHelp}
				onClose={() => setShowHelp(false)}
			/>
			{/* Top bar — desktop only header */}
			<header
				style={{ viewTransitionName: "app-header" }}
				className="hidden md:flex items-center justify-between gap-8 px-6 py-3 border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-40"
			>
				<span className="font-display font-semibold text-xl text-foreground text-nowrap">
					{t("appName")}
				</span>

				<nav className="flex items-start gap-6 w-full">
					<NavItem
						to="/rounds"
						icon={<ShoppingBag size={16} />}
						label={t("nav.rounds")}
					/>
					<NavItem
						to="/customers"
						icon={<Users size={16} />}
						label={t("nav.customers")}
					/>
					<NavItem
						to="/products"
						icon={<Package size={16} />}
						label={t("nav.products")}
					/>
					<NavItem
						to="/dashboard"
						icon={<BarChart3 size={16} />}
						label={t("nav.dashboard")}
					/>
					<NavItem
						to="/settings"
						icon={<Settings size={16} />}
						label={t("nav.settings")}
					/>
				</nav>

				<div className="flex items-center gap-3">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={toggleDark}
						title={isDark ? t("theme.light") : t("theme.dark")}
						className="text-muted-foreground hover:text-foreground w-8 h-8 p-0"
					>
						{isDark ? <Sun size={15} /> : <Moon size={15} />}
					</Button>
					<LocaleSwitcher onLocaleChange={handleLocaleChange} />
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={handleLogout}
						className="gap-1.5 text-muted-foreground hover:text-foreground"
					>
						<LogOut size={15} />
						{t("logout")}
					</Button>
				</div>
			</header>

			{/* Page content */}
			<main className="flex-1 pb-20 md:pb-0">
				<Outlet />
			</main>

			{/* Bottom tab bar — mobile only */}
			<nav
				style={{ viewTransitionName: "app-bottom-nav" }}
				className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur-sm border-t border-border safe-area-pb"
			>
				<div className="grid grid-cols-5 h-16">
					<BottomNavItem
						to="/rounds"
						icon={<ShoppingBag size={22} />}
						label={t("nav.rounds")}
					/>
					<BottomNavItem
						to="/customers"
						icon={<Users size={22} />}
						label={t("nav.customers")}
					/>
					<BottomNavItem
						to="/products"
						icon={<Package size={22} />}
						label={t("nav.products")}
					/>
					<BottomNavItem
						to="/dashboard"
						icon={<BarChart3 size={22} />}
						label={t("nav.dashboard")}
					/>
					<button
						type="button"
						onClick={() => setMoreOpen(true)}
						className="flex flex-col items-center justify-center gap-1 text-muted-foreground min-h-[44px]"
					>
						<Menu size={22} />
						<span className="text-[11px] font-medium">{t("nav.more")}</span>
					</button>
				</div>
			</nav>

			{/* More sheet — mobile settings, theme, language, logout */}
			<Sheet open={moreOpen} onOpenChange={setMoreOpen}>
				<SheetContent className="md:hidden">
					<SheetHeader>
						<SheetTitle className="text-left">{t("nav.more")}</SheetTitle>
					</SheetHeader>
					<SheetBody className="flex flex-col gap-1">
						<Link
							to="/settings"
							onClick={() => setMoreOpen(false)}
							className="flex items-center gap-3 px-3 py-3 rounded-md text-sm text-foreground hover:bg-accent transition-colors"
						>
							<Settings size={18} />
							{t("nav.settings")}
						</Link>
						<Separator className="my-2" />
						<button
							type="button"
							onClick={toggleDark}
							className="flex items-center gap-3 px-3 py-3 rounded-md text-sm text-foreground hover:bg-accent transition-colors w-full text-left"
						>
							{isDark ? <Sun size={18} /> : <Moon size={18} />}
							{isDark ? t("theme.light") : t("theme.dark")}
						</button>
						<LocaleSwitcherRow onLocaleChange={handleLocaleChange} />
						<Separator className="my-2" />
						<button
							type="button"
							onClick={handleLogout}
							className="flex items-center gap-3 px-3 py-3 rounded-md text-sm text-destructive hover:bg-destructive/10 transition-colors w-full text-left"
						>
							<LogOut size={18} />
							{t("logout")}
						</button>
					</SheetBody>
				</SheetContent>
			</Sheet>
		</div>
	);
}

function NavItem({
	to,
	icon,
	label,
}: {
	to: string;
	icon: React.ReactNode;
	label: string;
}) {
	return (
		<Link
			to={to}
			className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
			activeProps={{ className: "text-foreground font-medium" }}
		>
			{icon}
			{label}
		</Link>
	);
}

function BottomNavItem({
	to,
	icon,
	label,
}: {
	to: string;
	icon: React.ReactNode;
	label: string;
}) {
	return (
		<Link
			to={to}
			className="flex flex-col items-center justify-center gap-1 text-muted-foreground min-h-[44px]"
			activeProps={{ className: "text-foreground" }}
		>
			{icon}
			<span className="text-[11px] font-medium">{label}</span>
		</Link>
	);
}

function LocaleSwitcher({
	onLocaleChange,
}: {
	onLocaleChange: (locale: Locale) => void;
}) {
	const { t, i18n: i18nInstance } = useTranslation("common");
	const current = i18nInstance.language as Locale;
	const next: Locale = current === "th" ? "en" : "th";

	return (
		<Button
			type="button"
			variant="ghost"
			size="sm"
			onClick={() => onLocaleChange(next)}
			title={t(`language.${next}`)}
			className="gap-1.5 text-muted-foreground hover:text-foreground"
		>
			<Globe size={15} />
			<span>{t(`language.${next}`)}</span>
		</Button>
	);
}

function LocaleSwitcherRow({
	onLocaleChange,
}: {
	onLocaleChange: (locale: Locale) => void;
}) {
	const { t, i18n: i18nInstance } = useTranslation("common");
	const current = i18nInstance.language as Locale;
	const next: Locale = current === "th" ? "en" : "th";

	return (
		<button
			type="button"
			onClick={() => onLocaleChange(next)}
			className="flex items-center gap-3 px-3 py-3 rounded-md text-sm text-foreground hover:bg-accent transition-colors w-full text-left"
		>
			<Globe size={18} />
			{t(`language.${next}`)}
		</button>
	);
}
