import { useEffect, useState } from "react";

function getInitialDark(): boolean {
	if (typeof window === "undefined") return false;
	const stored = localStorage.getItem("theme");
	if (stored === "dark") return true;
	if (stored === "light") return false;
	return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function useDarkMode() {
	const [isDark, setIsDark] = useState(false);

	useEffect(() => {
		const dark = getInitialDark();
		setIsDark(dark);
		document.documentElement.classList.toggle("dark", dark);
	}, []);

	function toggle() {
		setIsDark((prev) => {
			const next = !prev;
			document.documentElement.classList.toggle("dark", next);
			localStorage.setItem("theme", next ? "dark" : "light");
			return next;
		});
	}

	return { isDark, toggle };
}
