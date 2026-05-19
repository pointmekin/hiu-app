import { createFileRoute } from "@tanstack/react-router";
import { RoundStatsSkeleton } from "#/components/round-skeletons";
import { RoundStatsDashboard } from "#/components/round-stats-dashboard";
import { getRoundStats } from "#/server/functions/dashboard/round-stats";

export const Route = createFileRoute("/_app/dashboard/round/$roundId")({
	loader: async ({ context: { queryClient }, params: { roundId } }) => {
		const promise = queryClient.ensureQueryData({
			queryKey: ["dashboard", "round", roundId],
			queryFn: () => getRoundStats({ data: { roundId } }),
		});
		if (typeof window === "undefined") {
			await promise;
		}
	},
	pendingComponent: RoundStatsSkeleton,
	component: RoundDashboardPage,
});

function RoundDashboardPage() {
	const { roundId } = Route.useParams();
	return <RoundStatsDashboard roundId={roundId} />;
}
