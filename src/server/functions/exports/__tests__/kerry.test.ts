import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import {
	KERRY_HEADERS,
	KERRY_TEMPLATE_PATH,
	addDataToKerryWorkbook,
	type KerryRow,
} from "../kerry";

const MOCK_ROWS: KerryRow[] = [
	{
		no: 1,
		recipientName: "สมชาย ใจดี",
		mobile: "0812345678",
		address: "123 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ",
		postalCode: "10110",
	},
	{
		no: 2,
		recipientName: "มานี รักเรียน",
		mobile: "0898765432",
		address: "456 ถนนพหลโยธิน แขวงลาดยาว เขตจตุจักร กรุงเทพฯ",
		postalCode: "10900",
	},
];

// Creates a minimal workbook that mirrors the real template structure:
// rows 1-8 are scaffolding (with row 8 being the real-data header), and
// rows 9+ contain stale customer data we expect the exporter to wipe.
async function makeMinimalTemplate(): Promise<ExcelJS.Workbook> {
	const wb = new ExcelJS.Workbook();
	const sheet = wb.addWorksheet("Kerry 215");
	sheet.getRow(2).getCell(1).value = "พื้นที่สีฟ้าห้ามลบ";
	sheet.getRow(2).commit();
	sheet.getRow(3).getCell(1).value = "ตัวอย่าง";
	sheet.getRow(3).commit();
	KERRY_HEADERS.forEach((h, i) => {
		sheet.getRow(4).getCell(i + 1).value = h;
	});
	sheet.getRow(4).commit();
	sheet.getRow(5).getCell(1).value = 1;
	sheet.getRow(5).getCell(2).value = "คุณตัวอย่าง ข้อมูล";
	sheet.getRow(5).commit();
	// Row 8: real-data header
	KERRY_HEADERS.forEach((h, i) => {
		sheet.getRow(8).getCell(i + 1).value = h;
	});
	sheet.getRow(8).commit();
	// Rows 9-11: stale customer data from a previous submission
	sheet.getRow(9).getCell(1).value = 1;
	sheet.getRow(9).getCell(2).value = "STALE CUSTOMER A";
	sheet.getRow(9).commit();
	sheet.getRow(10).getCell(1).value = 2;
	sheet.getRow(10).getCell(2).value = "STALE CUSTOMER B";
	sheet.getRow(10).commit();
	sheet.getRow(11).getCell(1).value = 3;
	sheet.getRow(11).getCell(2).value = "STALE CUSTOMER C";
	sheet.getRow(11).commit();
	return wb;
}

describe("kerry export", () => {
	// Golden-file test: row 4 (preview header) AND row 8 (real-data header) of the
	// real template must both match KERRY_HEADERS exactly. If this fails, verify
	// the change with Chom and get the updated template before merging.
	it("KERRY_HEADERS matches rows 4 and 8 of the real template (golden-file)", async () => {
		const wb = new ExcelJS.Workbook();
		await wb.xlsx.readFile(KERRY_TEMPLATE_PATH);
		const sheet = wb.worksheets[0];
		for (const headerRowNum of [4, 8]) {
			const headerRow = sheet.getRow(headerRowNum);
			const actual: string[] = [];
			for (let c = 1; c <= KERRY_HEADERS.length; c++) {
				const val = headerRow.getCell(c).value;
				actual.push(val != null ? String(val) : "");
			}
			expect(actual, `row ${headerRowNum}`).toEqual([...KERRY_HEADERS]);
		}
	});

	it("real template has 3 sheets", async () => {
		const wb = new ExcelJS.Workbook();
		await wb.xlsx.readFile(KERRY_TEMPLATE_PATH);
		expect(wb.worksheets).toHaveLength(3);
	});

	describe("addDataToKerryWorkbook", () => {
		it("preserves rows 1-8 (scaffolding) and writes data from row 9 onwards", async () => {
			const wb = await makeMinimalTemplate();
			addDataToKerryWorkbook(wb, MOCK_ROWS);

			const sheet = wb.worksheets[0];

			// Rows 1-8 untouched
			expect(sheet.getRow(2).getCell(1).value).toBe("พื้นที่สีฟ้าห้ามลบ");
			expect(sheet.getRow(3).getCell(1).value).toBe("ตัวอย่าง");
			expect(sheet.getRow(4).getCell(1).value).toBe("No");
			expect(sheet.getRow(5).getCell(2).value).toBe("คุณตัวอย่าง ข้อมูล");
			expect(sheet.getRow(8).getCell(2).value).toBe("*ชื่อผู้รับ/Recipient Name");

			// Row 9: first real customer
			const row9 = sheet.getRow(9);
			expect(row9.getCell(1).value).toBe(1);
			expect(row9.getCell(2).value).toBe("สมชาย ใจดี");
			expect(row9.getCell(3).value).toBe("0812345678");
			expect(row9.getCell(4).value).toBe(
				"123 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ",
			);
			expect(row9.getCell(5).value).toBe("10110");

			const row10 = sheet.getRow(10);
			expect(row10.getCell(1).value).toBe(2);
			expect(row10.getCell(2).value).toBe("มานี รักเรียน");
		});

		it("wipes stale customer data beyond the new rows", async () => {
			const wb = await makeMinimalTemplate();
			// Template has stale rows 9, 10, 11. We only write 2 new rows (9, 10).
			// Row 11's stale "STALE CUSTOMER C" must be cleared.
			addDataToKerryWorkbook(wb, MOCK_ROWS);

			const sheet = wb.worksheets[0];
			expect(sheet.getRow(11).getCell(1).value).toBeNull();
			expect(sheet.getRow(11).getCell(2).value).toBeNull();
		});

		it("wipes all stale data when there are no orders", async () => {
			const wb = await makeMinimalTemplate();
			addDataToKerryWorkbook(wb, []);

			const sheet = wb.worksheets[0];
			// Scaffolding (1-8) intact
			expect(sheet.getRow(8).getCell(2).value).toBe("*ชื่อผู้รับ/Recipient Name");
			// All stale data gone
			expect(sheet.getRow(9).getCell(2).value).toBeNull();
			expect(sheet.getRow(10).getCell(2).value).toBeNull();
			expect(sheet.getRow(11).getCell(2).value).toBeNull();
		});

		it("populates all sheets when workbook has multiple sheets", async () => {
			const wb = await makeMinimalTemplate();
			wb.addWorksheet("Kerry 14");
			addDataToKerryWorkbook(wb, MOCK_ROWS);

			for (const sheet of wb.worksheets) {
				expect(sheet.getRow(9).getCell(2).value).toBe("สมชาย ใจดี");
			}
		});

		// End-to-end test against the real template — the actual bug that bit us.
		it("strips all 74 stale customers from the real template (E2E)", async () => {
			const wb = new ExcelJS.Workbook();
			await wb.xlsx.readFile(KERRY_TEMPLATE_PATH);
			addDataToKerryWorkbook(wb, MOCK_ROWS);

			// Re-serialize and re-load to catch persistence bugs (spliceRows fails here).
			const buf = await wb.xlsx.writeBuffer();
			const verify = new ExcelJS.Workbook();
			await verify.xlsx.load(buf);

			for (const sheet of verify.worksheets) {
				// First real row
				expect(sheet.getRow(9).getCell(2).value).toBe("สมชาย ใจดี");
				expect(sheet.getRow(10).getCell(2).value).toBe("มานี รักเรียน");
				// No stale customer leaked through
				for (let r = 11; r <= sheet.rowCount; r++) {
					const c2 = sheet.getRow(r).getCell(2).value;
					expect(c2, `sheet ${sheet.name} row ${r} should be empty`).toBeNull();
				}
			}
		});
	});
});
