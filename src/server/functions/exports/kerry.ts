import path from "node:path";
import ExcelJS from "exceljs";
import { and, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "#/db/index";
import { customerAddresses, customers, orders } from "#/db/schema";

// Golden constant — any change here must be verified against the real Kerry template (row 4).
// If this fails, get an updated template from Chom before merging.
export const KERRY_HEADERS = [
	"No",
	"*ชื่อผู้รับ/Recipient Name",
	"*เบอร์ผู้รับ/Mobile No.",
	"*ที่อยู่/Address",
	"*รหัสไปรษณีย์/Postal code",
	"COD Amt (Baht)",
	"ชื่อสินค้า/Product name",
	"น้ำหนัก/Weight(kg)",
	"กว้าง/Width(cm)",
	"ยาว/Length(cm)",
	"สูง/Height(cm)",
	"Remark",
	"Ref #1",
	"Ref #2",
	"Sender Ref",
] as const;

// Template scaffolding spans rows 1-8:
//   1     empty
//   2     "พื้นที่สีฟ้าห้ามลบ" (blue protected area marker)
//   3     "ตัวอย่าง" (example label)
//   4     headers (preview row)
//   5     example data ("คุณตัวอย่าง ข้อมูล")
//   6-7   empty separators
//   8     headers (real data section)
// Actual data goes from row 9 onwards.
const DATA_START_ROW = 9;

export const KERRY_TEMPLATE_PATH = path.join(
	process.cwd(),
	"docs/templates/kerry - 21-05-2026.xlsx",
);

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
		.leftJoin(
			defaultAddr,
			and(
				eq(defaultAddr.customerId, orders.customerId),
				eq(defaultAddr.isDefault, true),
			),
		)
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

export async function loadKerryTemplate(
	templatePath = KERRY_TEMPLATE_PATH,
): Promise<ExcelJS.Workbook> {
	const workbook = new ExcelJS.Workbook();
	await workbook.xlsx.readFile(templatePath);
	return workbook;
}

// Clears every cell from DATA_START_ROW onwards, then writes the current round's
// orders in their place. The template ships with a real previous Kerry submission
// embedded (74 customers in sheet 1, 63 in sheet 2, 23 in sheet 3) — those must
// be wiped or they leak into the export. Rows 1-8 (template scaffolding incl.
// blue area, example row, real-data header) are untouched.
//
// NOTE: `sheet.spliceRows` does NOT work reliably on this file — rows persist
// after save. We have to null every cell explicitly.
export function addDataToKerryWorkbook(
	workbook: ExcelJS.Workbook,
	rows: KerryRow[],
): ExcelJS.Workbook {
	workbook.eachSheet((sheet) => {
		const lastRow = sheet.rowCount;
		for (let r = DATA_START_ROW; r <= lastRow; r++) {
			const row = sheet.getRow(r);
			for (let c = 1; c <= KERRY_HEADERS.length; c++) {
				row.getCell(c).value = null;
			}
			row.commit();
		}

		rows.forEach((rowData, index) => {
			const row = sheet.getRow(DATA_START_ROW + index);
			row.getCell(1).value = rowData.no;
			row.getCell(2).value = rowData.recipientName;
			row.getCell(3).value = rowData.mobile;
			row.getCell(4).value = rowData.address;
			row.getCell(5).value = rowData.postalCode;
			row.commit();
		});
	});
	return workbook;
}

export async function buildKerryWorkbook(roundId: string): Promise<ArrayBuffer> {
	const [data, workbook] = await Promise.all([
		fetchKerryData(roundId),
		loadKerryTemplate(),
	]);
	addDataToKerryWorkbook(workbook, data);
	return workbook.xlsx.writeBuffer();
}
