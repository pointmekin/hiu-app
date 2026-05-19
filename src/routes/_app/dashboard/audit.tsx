import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ScrollText } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "#/components/empty-state";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";
import { Skeleton } from "#/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "#/components/ui/table";
import {
	type AuditLogEntry,
	listAuditLog,
} from "#/server/functions/audit/list";

const ENTITY_OPTIONS = [
	"order",
	"order_payment",
	"round",
	"round_product",
	"product",
	"customer",
	"settings",
] as const;

export const Route = createFileRoute("/_app/dashboard/audit")({
	component: AuditLogViewer,
});

function AuditLogViewer() {
	const { t } = useTranslation("dashboard");
	const [entity, setEntity] = useState<string | undefined>(undefined);

	const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
		useInfiniteQuery({
			queryKey: ["audit", entity],
			queryFn: ({ pageParam }) =>
				listAuditLog({
					data: { entity, limit: 50, cursor: pageParam as number | undefined },
				}) as Promise<AuditLogEntry[]>,
			initialPageParam: undefined as number | undefined,
			getNextPageParam: (lastPage: AuditLogEntry[]) =>
				lastPage.length > 0 ? lastPage[lastPage.length - 1].id : undefined,
		});

	if (isLoading) {
		return (
			<Card>
				<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
					<CardTitle className="font-display text-lg">
						{t("audit.title")}
					</CardTitle>
					<Skeleton className="h-9 w-48" />
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						{Array.from({ length: 8 }).map((_, i) => (
							<div
								// biome-ignore lint/suspicious/noArrayIndexKey: static list
								key={i}
								className="flex items-center justify-between py-3 border-b border-border last:border-0"
							>
								<Skeleton className="h-4 w-24" />
								<Skeleton className="h-4 w-20" />
								<Skeleton className="h-4 w-16" />
								<Skeleton className="h-4 flex-1 mx-8 hidden md:block" />
								<Skeleton className="h-4 w-32" />
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		);
	}

	const entries: AuditLogEntry[] =
		data?.pages.flatMap((page) => page as AuditLogEntry[]) ?? [];

	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
				<CardTitle className="font-display text-lg">
					{t("audit.title")}
				</CardTitle>
				<Select
					value={entity ?? "all"}
					onValueChange={(v) => setEntity(v === "all" ? undefined : v)}
				>
					<SelectTrigger className="w-48">
						<SelectValue placeholder={t("audit.filter.placeholder")} />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">{t("audit.filter.all")}</SelectItem>
						{ENTITY_OPTIONS.map((e) => (
							<SelectItem key={e} value={e}>
								{e}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</CardHeader>
			<CardContent>
				{entries.length === 0 ? (
					<EmptyState icon={<ScrollText />} title={t("audit.empty")} />
				) : (
					<>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>{t("audit.user")}</TableHead>
									<TableHead>{t("audit.entity")}</TableHead>
									<TableHead>{t("audit.action")}</TableHead>
									<TableHead className="hidden md:table-cell">
										{t("audit.details")}
									</TableHead>
									<TableHead>{t("audit.timestamp")}</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{entries.map((entry) => (
									<TableRow key={entry.id}>
										<TableCell className="text-sm">
											{entry.userName ?? "—"}
										</TableCell>
										<TableCell className="text-sm font-mono">
											{entry.entity}
										</TableCell>
										<TableCell className="text-sm">
											{actionLabel(entry.action, t)}
										</TableCell>
										<TableCell className="hidden md:table-cell text-xs text-muted-foreground max-w-48 truncate">
											{entry.diff ? entry.diff.slice(0, 80) : "—"}
										</TableCell>
										<TableCell className="text-xs text-muted-foreground whitespace-nowrap">
											{formatTimestamp(entry.at)}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
						{hasNextPage && (
							<div className="flex justify-center pt-4">
								<Button
									variant="outline"
									size="sm"
									onClick={() => fetchNextPage()}
									disabled={isFetchingNextPage}
								>
									{t("audit.loadMore")}
								</Button>
							</div>
						)}
					</>
				)}
			</CardContent>
		</Card>
	);
}

function actionLabel(action: string, t: (key: string) => string): string {
	const key = `dashboard:audit.actions.${action}`;
	const label = t(key);
	return label === key ? action : label;
}

function formatTimestamp(at: string): string {
	return new Intl.DateTimeFormat("th-TH", {
		dateStyle: "short",
		timeStyle: "short",
		timeZone: "Asia/Bangkok",
	}).format(new Date(at));
}
