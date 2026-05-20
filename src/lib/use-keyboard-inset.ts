import { useEffect, useState } from "react";

export function useKeyboardInset(): number {
	const [inset, setInset] = useState(0);

	useEffect(() => {
		const vv = window.visualViewport;
		if (!vv) return;

		function update() {
			const h = Math.max(
				0,
				window.innerHeight - vv!.height - vv!.pageTop,
			);
			setInset(h);
		}

		vv.addEventListener("resize", update);
		vv.addEventListener("scroll", update);
		return () => {
			vv.removeEventListener("resize", update);
			vv.removeEventListener("scroll", update);
		};
	}, []);

	return inset;
}
