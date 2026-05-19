import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

const SEQUENCE_TIMEOUT_MS = 500;

const SHORTCUTS = [
	{ keys: ["g", "r"], to: "/rounds", label: "Go to Rounds" },
	{ keys: ["g", "c"], to: "/customers", label: "Go to Customers" },
	{ keys: ["g", "p"], to: "/products", label: "Go to Products" },
	{ keys: ["g", "d"], to: "/dashboard", label: "Go to Dashboard" },
] as const;

export function useKeyboardShortcuts() {
	const navigate = useNavigate();
	const [pendingKey, setPendingKey] = useState<string | null>(null);
	const [showHelp, setShowHelp] = useState(false);

	useEffect(() => {
		function handleKeyDown(e: KeyboardEvent) {
			const target = e.target as HTMLElement;
			if (
				target.tagName === "INPUT" ||
				target.tagName === "TEXTAREA" ||
				target.tagName === "SELECT" ||
				target.isContentEditable
			) {
				return;
			}

			if (e.key === "Escape") {
				setShowHelp(false);
				setPendingKey(null);
				return;
			}

			if (e.key === "?") {
				setShowHelp((prev) => !prev);
				setPendingKey(null);
				return;
			}

			const key = e.key.toLowerCase();

			if (pendingKey) {
				const match = SHORTCUTS.find(
					(s) => s.keys[0] === pendingKey && s.keys[1] === key,
				);
				if (match) {
					navigate({ to: match.to });
				}
				setPendingKey(null);
				return;
			}

			if (key === "g") {
				setPendingKey("g");
				setTimeout(() => setPendingKey(null), SEQUENCE_TIMEOUT_MS);
			}
		}

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [pendingKey, navigate]);

	return { showHelp, setShowHelp };
}

export function ShortcutHelpOverlay({
	showHelp,
	onClose,
}: {
	showHelp: boolean;
	onClose: () => void;
}) {
	if (!showHelp) return null;

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm"
			onClick={onClose}
		>
			<div
				className="bg-card border border-border rounded-lg shadow-lg p-6 max-w-sm w-full"
				onClick={(e) => e.stopPropagation()}
			>
				<h2 className="font-display text-lg font-semibold mb-4">
					Keyboard Shortcuts
				</h2>
				<ul className="space-y-2 text-sm">
					{SHORTCUTS.map((s) => (
						<li key={s.to} className="flex justify-between">
							<span className="text-muted-foreground">{s.label}</span>
							<kbd className="font-mono bg-muted px-2 py-0.5 rounded text-xs">
								{s.keys.join(" → ")}
							</kbd>
						</li>
					))}
					<li className="flex justify-between">
						<span className="text-muted-foreground">Toggle this help</span>
						<kbd className="font-mono bg-muted px-2 py-0.5 rounded text-xs">
							?
						</kbd>
					</li>
				</ul>
			</div>
		</div>
	);
}
