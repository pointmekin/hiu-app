// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { Suspense } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { Route } from "../$orderId";

const { getOrder, getCustomer, saveDefault, updateOrder } = vi.hoisted(() => ({
	getOrder: vi.fn(),
	getCustomer: vi.fn(),
	saveDefault: vi.fn(),
	updateOrder: vi.fn(),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
	...(await importOriginal<typeof import("@tanstack/react-router")>()),
	useParams: () => ({ roundId: "round", orderId: "order" }),
	useLocation: () => ({}),
	useNavigate: () => vi.fn(),
	Link: () => null,
}));
vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("#/server/functions/orders/get", () => ({ getOrder }));
vi.mock("#/server/functions/orders/update", () => ({
	updateOrder,
	saveDefaultOrderAddress: saveDefault,
}));
vi.mock("#/server/functions/customers/get", () => ({ getCustomer }));
vi.mock("#/server/functions/round-products/list", () => ({
	listRoundProducts: async () => [],
}));
vi.mock("#/server/functions/rounds/get", () => ({
	getRound: async () => ({}),
}));
vi.mock("#/server/functions/settings/get", () => ({
	getSettings: async () => ({}),
}));

afterEach(() => {
	cleanup();
	vi.resetAllMocks();
});

it.each([
	false,
	true,
])("saves a newly available default while preserving other edits (retry: %s)", async (retry) => {
	const order = {
		customerId: "customer",
		customerName: "Test Customer",
		addressId: null as string | null,
		shippingFeeThb: "0",
		paidAmountThb: "0",
		totalThb: "0",
		paymentStatus: "pending",
		status: "active",
		items: [],
		payments: [],
	};
	getOrder.mockImplementation(async () => ({ ...order }));
	getCustomer.mockResolvedValue({ id: "customer", addresses: [] });
	saveDefault.mockImplementation(async () => {
		order.addressId = "default";
		return true;
	});
	if (retry)
		saveDefault.mockRejectedValueOnce(new Error("Address save failed"));
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	client.setQueryData(["orders", "order"], { ...order });
	client.setQueryData(["customers", "customer"], {
		id: "customer",
		addresses: [],
	});
	const Page = Route.options.component;
	if (!Page) throw new Error("Missing order page");

	await act(async () => {
		render(
			<QueryClientProvider client={client}>
				<Suspense>
					<Page />
				</Suspense>
			</QueryClientProvider>,
		);
	});
	await screen.findByText("customers:form.noAddress", {}, { timeout: 5000 });
	expect(saveDefault).not.toHaveBeenCalled();
	const note = screen.getByPlaceholderText("...") as HTMLInputElement;
	fireEvent.change(note, { target: { value: "Unsaved note" } });

	client.setQueryData(["customers", "customer"], {
		id: "customer",
		addresses: [
			{ id: "other", recipientName: "Other", address: "Other Street" },
			{
				id: "default",
				isDefault: true,
				recipientName: "Default",
				address: "Default Street",
			},
		],
	});

	await screen.findByText("Default · Default Street");
	if (retry) {
		fireEvent.click(
			await screen.findByRole("button", {
				name: "orders:action.retryAddressSave",
			}),
		);
	}
	await waitFor(() => {
		expect(saveDefault).toHaveBeenCalledTimes(retry ? 2 : 1);
		expect(saveDefault).toHaveBeenLastCalledWith({
			data: { id: "order", customerId: "customer", addressId: "default" },
		});
	});
	await waitFor(() =>
		expect(client.getQueryData(["orders", "order"])).toMatchObject({
			addressId: "default",
		}),
	);
	expect(note.value).toBe("Unsaved note");
	expect(updateOrder).not.toHaveBeenCalled();
});
