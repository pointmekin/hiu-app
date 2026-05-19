import type ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { buildJapan05WorkbookFromData, JAPAN05_SHEET_NAMES } from "../japan05";

const MOCK_ROWS = [
	{
		orderId: "order-1",
		customerId: "cust-1",
		customerName: "สมชาย",
		subtotalThb: "1000.00",
		shippingFeeThb: "50.00",
		totalThb: "1050.00",
		paidAmountThb: "1050.00",
		paymentStatus: "paid",
		quantity: 2,
		unitPriceThb: "500.00",
		lineTotalThb: "1000.00",
		storeLocation: "Don Quijote",
		foreignPrice: "2000.00",
		productName: "ครีมกันแดด",
		sourceCurrency: "JPY",
	},
	{
		orderId: "order-1",
		customerId: "cust-1",
		customerName: "สมชาย",
		subtotalThb: "1000.00",
		shippingFeeThb: "50.00",
		totalThb: "1050.00",
		paidAmountThb: "1050.00",
		paymentStatus: "paid",
		quantity: 1,
		unitPriceThb: "300.00",
		lineTotalThb: "300.00",
		storeLocation: null,
		foreignPrice: "1200.00",
		productName: "แชมพู",
		sourceCurrency: "JPY",
	},
	{
		orderId: "order-2",
		customerId: "cust-2",
		customerName: "มานี",
		subtotalThb: "700.00",
		shippingFeeThb: "50.00",
		totalThb: "750.00",
		paidAmountThb: "0.00",
		paymentStatus: "pending",
		quantity: 1,
		unitPriceThb: "700.00",
		lineTotalThb: "700.00",
		storeLocation: "Matsukiyo",
		foreignPrice: "2800.00",
		productName: "ครีมกันแดด",
		sourceCurrency: "JPY",
	},
];

describe("japan05 export", () => {
	it("exports correct sheet names", () => {
		expect(JAPAN05_SHEET_NAMES).toEqual(["ออเดอร์", "สรุปยอด", "รวมยอดลูกค้า"]);
	});

	describe("buildJapan05WorkbookFromData", () => {
		it("creates workbook with 3 sheets", () => {
			const wb = buildJapan05WorkbookFromData(MOCK_ROWS);
			expect(wb.worksheets).toHaveLength(3);
			expect(wb.worksheets.map((s) => s.name)).toEqual([
				"ออเดอร์",
				"สรุปยอด",
				"รวมยอดลูกค้า",
			]);
		});

		it("orders sheet has correct column headers", () => {
			const wb = buildJapan05WorkbookFromData(MOCK_ROWS);
			const sheet = wb.getWorksheet("ออเดอร์")!;
			const headers = sheet.getRow(1).values as ExcelJS.CellValue[];
			// ExcelJS row.values is 1-indexed (index 0 is undefined)
			expect(headers.slice(1)).toEqual([
				"ลูกค้า",
				"สินค้า",
				"จำนวน",
				"ราคา/ชิ้น (฿)",
				"รวม (฿)",
				"ร้าน",
				"สถานะชำระ",
			]);
		});

		it("orders sheet has one row per order item", () => {
			const wb = buildJapan05WorkbookFromData(MOCK_ROWS);
			const sheet = wb.getWorksheet("ออเดอร์")!;
			// 3 mock rows + 1 header row
			expect(sheet.rowCount).toBe(4);
		});

		it("summary sheet aggregates products across orders", () => {
			const wb = buildJapan05WorkbookFromData(MOCK_ROWS);
			const sheet = wb.getWorksheet("สรุปยอด")!;
			// ครีมกันแดด appears in two different stores → 2 rows; แชมพู → 1 row
			// ครีมกันแดด @ Don Quijote qty=2, ครีมกันแดด @ Matsukiyo qty=1, แชมพู @ "" qty=1
			expect(sheet.rowCount).toBe(4); // 1 header + 3 data rows
		});

		it("customer sheet has one row per customer", () => {
			const wb = buildJapan05WorkbookFromData(MOCK_ROWS);
			const sheet = wb.getWorksheet("รวมยอดลูกค้า")!;
			// 2 customers
			expect(sheet.rowCount).toBe(3); // 1 header + 2 data rows
		});

		it("customer sheet computes balance correctly", () => {
			const wb = buildJapan05WorkbookFromData(MOCK_ROWS);
			const sheet = wb.getWorksheet("รวมยอดลูกค้า")!;
			// สมชาย: total=1050, paid=1050, balance=0
			const row2 = sheet.getRow(2).values as ExcelJS.CellValue[];
			// columns: customer(1) subtotal(2) shipping(3) total(4) paid(5) balance(6) status(7)
			expect(row2[6]).toBe(0); // balance
		});
	});
});
