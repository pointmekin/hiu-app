export const AddressStatus = {
	Assigned: "assigned",
	Unassigned: "unassigned",
	Missing: "missing",
} as const;

export type AddressStatus = (typeof AddressStatus)[keyof typeof AddressStatus];

interface AddressFields {
	id: string;
	recipientName: string;
	mobile: string;
	address: string;
	postalCode: string;
}

const isBlank = (value: string) => {
	const trimmed = value.trim();
	return trimmed === "" || trimmed === "-";
};

export function isEmptyAddress(address: AddressFields): boolean {
	return [
		address.recipientName,
		address.mobile,
		address.address,
		address.postalCode,
	].every(isBlank);
}

export function getAddressStatus(
	orderAddressId: string | null,
	customerAddresses: AddressFields[],
): AddressStatus {
	const usable = customerAddresses.filter((a) => !isEmptyAddress(a));
	if (usable.length === 0) return AddressStatus.Missing;
	if (usable.some((a) => a.id === orderAddressId))
		return AddressStatus.Assigned;
	return AddressStatus.Unassigned;
}
