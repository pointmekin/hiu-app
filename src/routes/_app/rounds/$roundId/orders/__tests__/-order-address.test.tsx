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

const { getOrder, getCustomer, saveDefault, updateOrder, deletePayment } =
	vi.hoisted(() => ({
		getOrder: vi.fn(),
		getCustomer: vi.fn(),
		saveDefault: vi.fn(),
		updateOrder: vi.fn(),
		deletePayment: vi.fn(),
	}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
	...(await importOriginal<typeof import("@tanstack/react-router")>()),
	useParams: () => ({ roundId: "round", orderId: "order" }),
	useLocation: () => ({}),
	useNavigate: () => vi.fn(),
	Link: () => null,
}));
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { resolvedLanguage: "en" },
	}),
}));
vi.mock("#/server/functions/payments/record", () => ({ deletePayment }));
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
	vi.restoreAllMocks();
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

it("refreshes the customer summary after repricing without resetting the draft", async () => {
	const item = {
		roundProductId: "round-product",
		productId: "product",
		productName: "Test product",
		unitPriceThb: "0.00",
		quantity: 2,
	};
	const order = {
		customerId: "customer",
		customerName: "Test Customer",
		addressId: null,
		shippingFeeThb: "50.00",
		paidAmountThb: "0.00",
		totalThb: "50.00",
		paymentStatus: "pending",
		status: "active",
		items: [item],
		payments: [],
	};
	getOrder.mockResolvedValue(order);
	getCustomer.mockResolvedValue({ id: "customer", addresses: [] });
	const client = new QueryClient();
	client.setQueryData(["orders", "order"], order);
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
	await screen.findAllByText(/Test product ×2: 0/);
	const note = screen.getByPlaceholderText("...") as HTMLInputElement;
	fireEvent.change(note, { target: { value: "Unsaved note" } });

	getOrder.mockResolvedValue({
		...order,
		totalThb: "350.00",
		items: [{ ...item, unitPriceThb: "150.00" }],
	});
	await act(async () => {
		await client.invalidateQueries({ queryKey: ["orders", "order"] });
	});
	await screen.findAllByText(/Test product ×2: 300/);
	expect(note.value).toBe("Unsaved note");
});

it("uses the reconciled history when another tab deleted a payment and refreshing fails", async () => {
	const order = {
		customerId: "customer",
		customerName: "Test Customer",
		addressId: null,
		shippingFeeThb: "100.00",
		paidAmountThb: "100.00",
		totalThb: "100.00",
		paymentStatus: "paid",
		status: "active",
		items: [],
		payments: [
			{
				id: "payment",
				type: "remainder",
				amountThb: "50.00",
				paidAt: new Date(),
			},
			{
				id: "other-payment",
				type: "deposit",
				amountThb: "50.00",
				paidAt: new Date(),
			},
		],
	};
	getOrder.mockResolvedValue(order);
	getCustomer.mockResolvedValue({ id: "customer", addresses: [] });
	deletePayment.mockImplementation(async () => {
		getOrder.mockRejectedValue(new Error("Order refresh failed"));
		return { paidAmountThb: "0.00", paymentStatus: "pending", payments: [] };
	});
	const confirm = vi
		.spyOn(window, "confirm")
		.mockReturnValueOnce(false)
		.mockReturnValueOnce(true);
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	client.setQueryData(["orders", "order"], order);
	const Page = Route.options.component;
	if (!Page) throw new Error("Missing order page");

	render(
		<QueryClientProvider client={client}>
			<Suspense>
				<Page />
			</Suspense>
		</QueryClientProvider>,
	);
	const [deleteButton] = await screen.findAllByRole("button", {
		name: "payments:history.delete",
	});
	fireEvent.click(deleteButton);
	expect(confirm).toHaveBeenCalledWith("payments:history.deleteConfirm");
	expect(deletePayment).not.toHaveBeenCalled();

	fireEvent.click(deleteButton);
	await waitFor(() =>
		expect(client.getQueryState(["orders", "order"])?.status).toBe("error"),
	);
	expect(screen.getByText("orders:paymentStatus.pending")).toBeTruthy();
	expect(client.getQueryData(["orders", "order"])).toMatchObject({
		paidAmountThb: "0.00",
		payments: [],
	});
	expect(deletePayment).toHaveBeenCalledExactlyOnceWith({
		data: { orderId: "order", paymentId: "payment" },
	});
	expect(screen.queryAllByText("payments:history.title")).toHaveLength(0);
});
