import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

export function PageProgressBar() {
	const isLoading = useRouterState({ select: (s) => s.isLoading });
	const [visible, setVisible] = useState(false);
	const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		if (isLoading) {
			if (hideTimer.current) clearTimeout(hideTimer.current);
			setVisible(true);
		} else {
			hideTimer.current = setTimeout(() => setVisible(false), 350);
		}
		return () => {
			if (hideTimer.current) clearTimeout(hideTimer.current);
		};
	}, [isLoading]);

	if (!visible) return null;

	return (
		<div
			aria-hidden="true"
			data-loading={isLoading || undefined}
			className="page-progress-bar"
		/>
	);
}
