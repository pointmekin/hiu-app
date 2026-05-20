import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
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

		window.location.href = "/rounds";
	}

	return (
		<div className="min-h-dvh flex items-center justify-center bg-background p-4">
			<div className="w-full max-w-sm">
				<h1 className="font-display text-3xl font-semibold text-center mb-8 text-foreground">
					OopsFoundThis
				</h1>

				<Card>
					<CardHeader>
						<CardTitle>{t("login.title")}</CardTitle>
					</CardHeader>
					<CardContent>
						<form onSubmit={handleSubmit} className="space-y-4">
							<div className="space-y-1.5">
								<Label htmlFor="email">{t("login.email")}</Label>
								<Input
									id="email"
									type="email"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									required
									autoComplete="email"
								/>
							</div>

							<div className="space-y-1.5">
								<Label htmlFor="password">{t("login.password")}</Label>
								<Input
									id="password"
									type="password"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									required
									autoComplete="current-password"
								/>
							</div>

							{error && (
								<Alert variant="destructive" role="alert">
									<AlertDescription>{error}</AlertDescription>
								</Alert>
							)}

							<Button
								type="submit"
								variant="default"
								disabled={isPending}
								className="w-full"
							>
								{isPending ? t("login.submitting") : t("login.submit")}
							</Button>
						</form>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
