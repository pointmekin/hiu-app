import { describe, expect, it } from "vitest";
import { AddressStatus, getAddressStatus } from "#/shared/address-status";

const filled = {
	id: "a1",
	recipientName: "Chom",
	mobile: "0812345678",
	address: "1 Sukhumvit",
	postalCode: "10110",
};
const dashes = {
	id: "a2",
	recipientName: "-",
	mobile: "-",
	address: " - ",
	postalCode: "-",
};

describe("getAddressStatus", () => {
	it("returns missing when the customer has no addresses", () => {
		expect(getAddressStatus(null, [])).toBe(AddressStatus.Missing);
	});

	it("treats an address with only dashes as missing", () => {
		expect(getAddressStatus("a2", [dashes])).toBe(AddressStatus.Missing);
	});

	it("returns unassigned when the order has no address", () => {
		expect(getAddressStatus(null, [filled])).toBe(AddressStatus.Unassigned);
	});

	it("returns unassigned when the order points to an empty address", () => {
		expect(getAddressStatus("a2", [filled, dashes])).toBe(
			AddressStatus.Unassigned,
		);
	});

	it("returns assigned when the order points to a filled address", () => {
		expect(getAddressStatus("a1", [filled])).toBe(AddressStatus.Assigned);
	});
});
