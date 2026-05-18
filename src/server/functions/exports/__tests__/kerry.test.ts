import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import {
	KERRY_HEADERS,
	buildKerryWorkbookFromData,
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

describe("kerry export", () => {
	// Golden-file test: headers must match the exact strings Kerry expects.
	// If this test fails after a header change, verify the change with Chom
	// and get the updated real Kerry template before merging.
	it("has exact expected headers (golden-file)", () => {
		expect(KERRY_HEADERS).toEqual([
			"No",
			"*ชื่อผู้รับ/Recipient Name",
			"*เบอร์ผู้รับ/Mobile No.",
			"*ที่อยู่/Address",
			"*รหัสไปรษณีย์/Postal code",
		]);
	});

	describe("buildKerryWorkbookFromData", () => {
		it("creates a workbook with exactly one sheet", () => {
			const wb = buildKerryWorkbookFromData(MOCK_ROWS);
			expect(wb.worksheets).toHaveLength(1);
		});

		it("first row matches KERRY_HEADERS exactly", () => {
			const wb = buildKerryWorkbookFromData(MOCK_ROWS);
			const sheet = wb.worksheets[0];
			const headerValues = sheet.getRow(1).values as ExcelJS.CellValue[];
			// ExcelJS row.values is 1-indexed
			expect(headerValues.slice(1)).toEqual([...KERRY_HEADERS]);
		});

		it("data rows match input", () => {
			const wb = buildKerryWorkbookFromData(MOCK_ROWS);
			const sheet = wb.worksheets[0];
			// 2 data rows + 1 header = 3 total
			expect(sheet.rowCount).toBe(3);

			const row2 = sheet.getRow(2).values as ExcelJS.CellValue[];
			expect(row2[1]).toBe(1); // no
			expect(row2[2]).toBe("สมชาย ใจดี"); // recipientName
			expect(row2[3]).toBe("0812345678"); // mobile
			expect(row2[5]).toBe("10110"); // postalCode
		});

		it("handles empty rows gracefully", () => {
			const wb = buildKerryWorkbookFromData([]);
			const sheet = wb.worksheets[0];
			expect(sheet.rowCount).toBe(1); // header only
		});
	});
});
