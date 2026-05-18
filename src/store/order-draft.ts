import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface DraftItem {
	roundProductId: string;
	productName: string;
	productBrand: string | null;
	unitPriceThb: number;
	quantity: number;
}

interface OrderDraftState {
	roundId: string | null;
	customerId: string | null;
	customerName: string | null;
	addressId: string | null;
	items: DraftItem[];
	shippingFeeThb: number;
	notes: string;
}

interface OrderDraftActions {
	initDraft: (roundId: string, defaultShippingFee: number) => void;
	setCustomer: (customerId: string, customerName: string, addressId?: string) => void;
	setAddress: (addressId: string) => void;
	addItem: (item: Omit<DraftItem, "quantity"> & { quantity?: number }) => void;
	updateItemQty: (roundProductId: string, quantity: number) => void;
	removeItem: (roundProductId: string) => void;
	setShippingFee: (fee: number) => void;
	setNotes: (notes: string) => void;
	reset: () => void;
}

const EMPTY: OrderDraftState = {
	roundId: null,
	customerId: null,
	customerName: null,
	addressId: null,
	items: [],
	shippingFeeThb: 50,
	notes: "",
};

export const useOrderDraft = create<OrderDraftState & OrderDraftActions>()(
	persist(
		(set, get) => ({
			...EMPTY,

			initDraft: (roundId, defaultShippingFee) => {
				const current = get();
				// Only reset if switching to a different round
				if (current.roundId !== roundId) {
					set({ ...EMPTY, roundId, shippingFeeThb: defaultShippingFee });
				}
			},

			setCustomer: (customerId, customerName, addressId) =>
				set({ customerId, customerName, addressId: addressId ?? null }),

			setAddress: (addressId) => set({ addressId }),

			addItem: (item) =>
				set((state) => {
					const existing = state.items.find(
						(i) => i.roundProductId === item.roundProductId,
					);
					if (existing) {
						return {
							items: state.items.map((i) =>
								i.roundProductId === item.roundProductId
									? { ...i, quantity: i.quantity + (item.quantity ?? 1) }
									: i,
							),
						};
					}
					return {
						items: [
							...state.items,
							{ ...item, quantity: item.quantity ?? 1 },
						],
					};
				}),

			updateItemQty: (roundProductId, quantity) =>
				set((state) => ({
					items: quantity <= 0
						? state.items.filter((i) => i.roundProductId !== roundProductId)
						: state.items.map((i) =>
								i.roundProductId === roundProductId ? { ...i, quantity } : i,
							),
				})),

			removeItem: (roundProductId) =>
				set((state) => ({
					items: state.items.filter((i) => i.roundProductId !== roundProductId),
				})),

			setShippingFee: (fee) => set({ shippingFeeThb: fee }),

			setNotes: (notes) => set({ notes }),

			reset: () => set(EMPTY),
		}),
		{
			name: "order-draft",
			partialize: (state) => ({
				roundId: state.roundId,
				customerId: state.customerId,
				customerName: state.customerName,
				addressId: state.addressId,
				items: state.items,
				shippingFeeThb: state.shippingFeeThb,
				notes: state.notes,
			}),
		},
	),
);

export function useOrderDraftSubtotal() {
	return useOrderDraft((s) =>
		s.items.reduce((acc, item) => acc + item.unitPriceThb * item.quantity, 0),
	);
}

export function useOrderDraftTotal() {
	const subtotal = useOrderDraftSubtotal();
	const shippingFee = useOrderDraft((s) => s.shippingFeeThb);
	return subtotal + shippingFee;
}
