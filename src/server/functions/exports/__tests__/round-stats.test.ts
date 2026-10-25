import type ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import {
	buildRoundStatsWorkbookFromData,
	ROUND_STATS_SHEET_NAMES,
	type RoundStatsExportData,
} from "../round-stats";

const DATA: RoundStatsExportData = {
	round: { name: "Japan May", sourceCurrency: "JPY", fxRate: "0.25" },
	orders: [
		{
			id: "aaaaaaaa-0000-0000-0000-000000000001",
			createdAt: new Date("2026-05-01T03:00:00Z"),
			customerName: "สมชาย",
			paymentStatus: "paid",
			subtotalThb: "1000.00",
			shippingFeeThb: "50.00",
			totalThb: "1050.00",
			paidAmountThb: "1050.00",
			isPacked: true,
			kerryTracking: "KER123",
		},
		{
			id: "bbbbbbbb-0000-0000-0000-000000000002",
			createdAt: new Date("2026-05-01T20:00:00Z"),
			customerName: "สมหญิง",
			paymentStatus: "partial",
			subtotalThb: "NaN",
			shippingFeeThb: "50.00",
			totalThb: "550.00",
			paidAmountThb: "200.00",
			isPacked: false,
			kerryTracking: null,
		},
	],
	items: [
		{
			orderId: "aaaaaaaa-0000-0000-0000-000000000001",
			customerName: "สมชาย",
			productName: "ครีมกันแดด",
			quantity: 2,
			unitPriceThb: "500.00",
			lineTotalThb: "1000.00",
			foreignPrice: "1600.00",
		},
		{
			orderId: "bbbbbbbb-0000-0000-0000-000000000002",
			customerName: "สมหญิง",
			productName: "แชมพู",
			quantity: 1,
			unitPriceThb: "500.00",
			lineTotalThb: "500.00",
			foreignPrice: "1200.00",
		},
	],
	payments: [
		{
			orderId: "aaaaaaaa-0000-0000-0000-000000000001",
			customerName: "สมชาย",
			paidAt: new Date("2026-05-01T05:00:00Z"),
			type: "full",
			method: "promptpay",
			amountThb: "1100.00",
		},
		{
			orderId: "aaaaaaaa-0000-0000-0000-000000000001",
			customerName: "สมชาย",
			paidAt: new Date("2026-05-03T05:00:00Z"),
			type: "refund",
			method: "promptpay",
			amountThb: "50.00",
		},
		{
			orderId: "bbbbbbbb-0000-0000-0000-000000000002",
			customerName: "สมหญิง",
			paidAt: new Date("2026-05-02T05:00:00Z"),
			type: "deposit",
			method: null,
			amountThb: "200.00",
		},
	],
};

function summaryValue(wb: ExcelJS.Workbook, label: string) {
	const sheet = wb.getWorksheet(ROUND_STATS_SHEET_NAMES.summary);
	let found: ExcelJS.CellValue;
	sheet?.eachRow((row) => {
		if (row.getCell(1).value === label) found = row.getCell(2).value;
	});
	return found as ExcelJS.CellFormulaValue;
}

describe("buildRoundStatsWorkbookFromData", () => {
	it("creates the sheets with the summary first", () => {
		const wb = buildRoundStatsWorkbookFromData(DATA);

		expect(wb.worksheets.map((s) => s.name)).toEqual([
			"สรุป",
			"รายการสินค้า",
			"ออเดอร์",
			"การชำระเงิน",
			"รายวัน",
		]);
	});

	it("calculates revenue, collection and margin as formulas with results", () => {
		const wb = buildRoundStatsWorkbookFromData(DATA);

		expect(summaryValue(wb, "รายรับที่คาดว่าจะได้")).toEqual({
			formula: "SUM('ออเดอร์'!G:G)",
			result: 1600,
		});
		expect(summaryValue(wb, "ได้รับแล้ว").result).toBe(1250);
		expect(summaryValue(wb, "ยอดค้างชำระ").result).toBe(350);
		// cost = (2 × 1600 + 1 × 1200) × 0.25; NaN subtotal counts as 0
		expect(summaryValue(wb, "ต้นทุนสินค้า").result).toBe(1100);
		expect(summaryValue(wb, "ยอดขายสินค้า").result).toBe(1000);
		expect(summaryValue(wb, "กำไรขั้นต้น").result).toBe(-100);
		expect(summaryValue(wb, "ค่าส่ง").result).toBe(100);
		expect(summaryValue(wb, "แพ็คแล้ว").result).toBe(1);
		expect(summaryValue(wb, "มีเลขพัสดุ Kerry").result).toBe(1);
	});

	it("nets refunds per payment method", () => {
		const wb = buildRoundStatsWorkbookFromData(DATA);

		expect(summaryValue(wb, "พร้อมเพย์").result).toBe(1050);
		expect(summaryValue(wb, "ไม่ระบุ").result).toBe(200);
		expect(summaryValue(wb, "โอนเงิน").formula).toBe(
			"SUMIF('การชำระเงิน'!E:E,\"โอนเงิน\",'การชำระเงิน'!G:G)",
		);
	});

	it("groups daily totals by Bangkok date with running totals", () => {
		const wb = buildRoundStatsWorkbookFromData(DATA);
		const sheet = wb.getWorksheet(ROUND_STATS_SHEET_NAMES.daily);
		const rows = [2, 3, 4].map((r) => {
			const row = sheet?.getRow(r);
			return [
				(row?.getCell(1).value as Date).toISOString().slice(0, 10),
				(row?.getCell(4).value as ExcelJS.CellFormulaValue).result,
				(row?.getCell(5).value as ExcelJS.CellFormulaValue).result,
			];
		});

		// 2026-05-01T20:00Z is 2026-05-02 in Bangkok
		expect(rows).toEqual([
			["2026-05-01", 1050, 1100],
			["2026-05-02", 1600, 1300],
			["2026-05-03", 1600, 1250],
		]);
	});
});
