import { createFileRoute, Outlet } from "@tanstack/react-router"

export const Route = createFileRoute("/_app/rounds/$roundId/orders")({
	component: () => <Outlet />,
})
