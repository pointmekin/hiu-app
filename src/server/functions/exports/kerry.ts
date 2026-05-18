import ExcelJS from "exceljs";
import { and, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "#/db/index";
import { customerAddresses, customers, orders } from "#/db/schema";

// Golden constant — any change here must be verified against the real Kerry template.
export const KERRY_HEADERS = [
	"No",
	"*ชื่อผู้รับ/Recipient Name",
	"*เบอร์ผู้รับ/Mobile No.",
	"*ที่อยู่/Address",
	"*รหัสไปรษณีย์/Postal code",
] as const;

export interface KerryRow {
	no: number;
	recipientName: string;
	mobile: string;
	address: string;
	postalCode: string;
}

export async function fetchKerryData(roundId: string): Promise<KerryRow[]> {
	const orderAddr = alias(customerAddresses, "order_addr");
	const defaultAddr = alias(customerAddresses, "default_addr");

	const rows = await db
		.select({
			orderId: orders.id,
			customerName: customers.displayName,
			recipientName: sql<string | null>`COALESCE(${orderAddr.recipientName}, ${defaultAddr.recipientName})`,
			mobile: sql<string | null>`COALESCE(${orderAddr.mobile}, ${defaultAddr.mobile})`,
			address: sql<string | null>`COALESCE(${orderAddr.address}, ${defaultAddr.address})`,
			postalCode: sql<string | null>`COALESCE(${orderAddr.postalCode}, ${defaultAddr.postalCode})`,
		})
		.from(orders)
		.innerJoin(customers, eq(orders.customerId, customers.id))
		.leftJoin(orderAddr, eq(orders.addressId, orderAddr.id))
		.leftJoin(defaultAddr, and(
			eq(defaultAddr.customerId, orders.customerId),
			eq(defaultAddr.isDefault, true),
		))
		.where(
			and(
				eq(orders.roundId, roundId),
				eq(orders.status, "active"),
				inArray(orders.paymentStatus, ["paid", "partial"]),
			),
		)
		.orderBy(customers.displayName);

	return rows.map((row, i) => ({
		no: i + 1,
		recipientName: row.recipientName ?? row.customerName,
		mobile: row.mobile ?? "",
		address: row.address ?? "",
		postalCode: row.postalCode ?? "",
	}));
}

export function buildKerryWorkbookFromData(rows: KerryRow[]): ExcelJS.Workbook {
	const workbook = new ExcelJS.Workbook();
	const sheet = workbook.addWorksheet("Kerry");

	sheet.columns = [
		{ header: KERRY_HEADERS[0], key: "no", width: 8 },
		{ header: KERRY_HEADERS[1], key: "recipientName", width: 30 },
		{ header: KERRY_HEADERS[2], key: "mobile", width: 18 },
		{ header: KERRY_HEADERS[3], key: "address", width: 48 },
		{ header: KERRY_HEADERS[4], key: "postalCode", width: 18 },
	];

	for (const row of rows) {
		sheet.addRow(row);
	}

	sheet.getRow(1).font = { bold: true };
	sheet.views = [{ state: "frozen", ySplit: 1 }];
	sheet.autoFilter = { from: "A1", to: "E1" };

	return workbook;
}

export async function buildKerryWorkbook(roundId: string): Promise<ArrayBuffer> {
	const data = await fetchKerryData(roundId);
	const workbook = buildKerryWorkbookFromData(data);
	return workbook.xlsx.writeBuffer();
}
