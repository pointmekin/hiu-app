import { createFileRoute } from "@tanstack/react-router";
import { RoundStatsDashboard } from "#/components/round-stats-dashboard";
import { RoundStatsSkeleton } from "#/components/round-skeletons";
import { getRoundStats } from "#/server/functions/dashboard/round-stats";

export const Route = createFileRoute("/_app/rounds/$roundId/stats")({
	loader: async ({ context: { queryClient }, params: { roundId } }) => {
		await queryClient.ensureQueryData({
			queryKey: ["dashboard", "round", roundId],
			queryFn: () => getRoundStats({ data: { roundId } }),
		});
	},
	pendingComponent: RoundStatsSkeleton,
	component: RoundStatsPage,
});

function RoundStatsPage() {
	const { roundId } = Route.useParams();
	return <RoundStatsDashboard roundId={roundId} />;
}
