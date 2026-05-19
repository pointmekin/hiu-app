import { createFileRoute } from "@tanstack/react-router";
import { RoundStatsDashboard } from "#/components/round-stats-dashboard";
import { getRoundStats } from "#/server/functions/dashboard/round-stats";

export const Route = createFileRoute("/_app/dashboard/round/$roundId")({
	component: RoundDashboardPage,
	loader: async ({ context: { queryClient }, params: { roundId } }) => {
		await queryClient.ensureQueryData({
			queryKey: ["dashboard", "round", roundId],
			queryFn: () => getRoundStats({ data: { roundId } }),
		});
	},
});

function RoundDashboardPage() {
	const { roundId } = Route.useParams();
	return <RoundStatsDashboard roundId={roundId} />;
}
