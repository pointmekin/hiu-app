import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { authClient } from "#/lib/auth-client";

export const Route = createFileRoute("/login")({
	beforeLoad: ({ context }) => {
		if (context.session) {
			throw redirect({ to: "/rounds" });
		}
	},
	component: LoginPage,
});

function LoginPage() {
	const { t } = useTranslation("auth");
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isPending, setIsPending] = useState(false);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setIsPending(true);

		const { error: authError } = await authClient.signIn.email({
			email,
			password,
		});

		if (authError) {
			setError(t("login.invalidCredentials"));
			setIsPending(false);
			return;
		}

		await router.invalidate();
		router.navigate({ to: "/rounds" });
	}

	return (
		<div className="min-h-dvh flex items-center justify-center bg-background p-4">
			<div className="w-full max-w-sm">
				<h1 className="font-display text-3xl font-semibold text-center mb-8 text-foreground">
					ร้านหิ้ว
				</h1>

				<div className="rounded-lg border border-border bg-card px-6 py-8 shadow-sm">
					<h2 className="text-lg font-semibold mb-6 text-card-foreground">
						{t("login.title")}
					</h2>

					<form onSubmit={handleSubmit} className="space-y-4">
						<div className="space-y-1.5">
							<label
								htmlFor="email"
								className="text-sm font-medium text-foreground"
							>
								{t("login.email")}
							</label>
							<input
								id="email"
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								required
								autoComplete="email"
								className="w-full rounded-md border border-border bg-background px-3 py-2 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
								style={{ fontSize: "16px" }}
							/>
						</div>

						<div className="space-y-1.5">
							<label
								htmlFor="password"
								className="text-sm font-medium text-foreground"
							>
								{t("login.password")}
							</label>
							<input
								id="password"
								type="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								required
								autoComplete="current-password"
								className="w-full rounded-md border border-border bg-background px-3 py-2 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
								style={{ fontSize: "16px" }}
							/>
						</div>

						{error && (
							<p className="text-sm text-destructive" role="alert">
								{error}
							</p>
						)}

						<button
							type="submit"
							disabled={isPending}
							className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
						>
							{isPending ? t("login.submitting") : t("login.submit")}
						</button>
					</form>
				</div>
			</div>
		</div>
	);
}
