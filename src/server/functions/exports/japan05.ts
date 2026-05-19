import { and, eq } from "drizzle-orm";
import ExcelJS from "exceljs";
import { db } from "#/db/index";
import {
	customers,
	orderItems,
	orders,
	products,
	roundProducts,
	rounds,
} from "#/db/schema";

export const JAPAN05_SHEET_NAMES = ["ออเดอร์", "สรุปยอด", "รวมยอดลูกค้า"] as const;

const THB_FMT = "#,##0.00";
const QTY_FMT = "#,##0";

interface ItemRow {
	orderId: string;
	customerId: string;
	customerName: string;
	subtotalThb: string;
	shippingFeeThb: string;
	totalThb: string;
	paidAmountThb: string;
	paymentStatus: string;
	quantity: number;
	unitPriceThb: string;
	lineTotalThb: string;
	storeLocation: string | null;
	foreignPrice: string;
	productName: string;
	sourceCurrency: string;
}

export async function fetchJapan05Data(roundId: string): Promise<ItemRow[]> {
	return db
		.select({
			orderId: orders.id,
			customerId: orders.customerId,
			customerName: customers.displayName,
			subtotalThb: orders.subtotalThb,
			shippingFeeThb: orders.shippingFeeThb,
			totalThb: orders.totalThb,
			paidAmountThb: orders.paidAmountThb,
			paymentStatus: orders.paymentStatus,
			quantity: orderItems.quantity,
			unitPriceThb: orderItems.unitPriceThb,
			lineTotalThb: orderItems.lineTotalThb,
			storeLocation: roundProducts.storeLocation,
			foreignPrice: roundProducts.foreignPrice,
			productName: products.name,
			sourceCurrency: rounds.sourceCurrency,
		})
		.from(orders)
		.innerJoin(customers, eq(orders.customerId, customers.id))
		.innerJoin(orderItems, eq(orderItems.orderId, orders.id))
		.innerJoin(roundProducts, eq(orderItems.roundProductId, roundProducts.id))
		.innerJoin(products, eq(roundProducts.productId, products.id))
		.innerJoin(rounds, eq(orders.roundId, rounds.id))
		.where(and(eq(orders.roundId, roundId), eq(orders.status, "active")))
		.orderBy(customers.displayName, orders.id, products.name);
}

function paymentStatusLabel(status: string): string {
	const labels: Record<string, string> = {
		pending: "รอชำระ",
		partial: "มัดจำแล้ว",
		paid: "ชำระแล้ว",
		refunded: "คืนเงิน",
	};
	return labels[status] ?? status;
}

function applySheetStyle(sheet: ExcelJS.Worksheet, lastCol: string): void {
	sheet.getRow(1).font = { bold: true };
	sheet.views = [{ state: "frozen", ySplit: 1 }];
	sheet.autoFilter = { from: "A1", to: `${lastCol}1` };
}

export function buildJapan05WorkbookFromData(
	rows: ItemRow[],
): ExcelJS.Workbook {
	const workbook = new ExcelJS.Workbook();

	// ── Sheet 1: ออเดอร์ (one row per order item) ──────────────────────────────
	const ordersSheet = workbook.addWorksheet(JAPAN05_SHEET_NAMES[0]);
	ordersSheet.columns = [
		{ header: "ลูกค้า", key: "customer", width: 24 },
		{ header: "สินค้า", key: "product", width: 32 },
		{ header: "จำนวน", key: "qty", width: 10 },
		{ header: "ราคา/ชิ้น (฿)", key: "unitThb", width: 16 },
		{ header: "รวม (฿)", key: "totalThb", width: 16 },
		{ header: "ร้าน", key: "store", width: 24 },
		{ header: "สถานะชำระ", key: "paymentStatus", width: 16 },
	];
	for (const row of rows) {
		const added = ordersSheet.addRow({
			customer: row.customerName,
			product: row.productName,
			qty: row.quantity,
			unitThb: Number(row.unitPriceThb),
			totalThb: Number(row.lineTotalThb),
			store: row.storeLocation ?? "",
			paymentStatus: paymentStatusLabel(row.paymentStatus),
		});
		added.getCell("qty").numFmt = QTY_FMT;
		added.getCell("unitThb").numFmt = THB_FMT;
		added.getCell("totalThb").numFmt = THB_FMT;
	}
	applySheetStyle(ordersSheet, "G");

	// ── Sheet 2: สรุปยอด (aggregated by product) ───────────────────────────────
	const summarySheet = workbook.addWorksheet(JAPAN05_SHEET_NAMES[1]);
	summarySheet.columns = [
		{ header: "สินค้า", key: "product", width: 32 },
		{ header: "รวมชิ้น", key: "totalQty", width: 12 },
		{ header: "ร้าน", key: "store", width: 24 },
		{ header: "ราคาต้นทาง", key: "foreignUnit", width: 16 },
		{ header: "รวมต้นทาง", key: "foreignTotal", width: 16 },
		{ header: "ราคา (฿)", key: "unitThb", width: 16 },
		{ header: "รวม (฿)", key: "totalThb", width: 16 },
	];
	const productMap = new Map<
		string,
		{
			productName: string;
			storeLocation: string | null;
			totalQty: number;
			foreignUnit: number;
			foreignTotal: number;
			unitThb: number;
			totalThb: number;
			sourceCurrency: string;
		}
	>();
	for (const row of rows) {
		const key = `${row.productName}||${row.storeLocation ?? ""}`;
		const existing = productMap.get(key);
		if (existing) {
			productMap.set(key, {
				...existing,
				totalQty: existing.totalQty + row.quantity,
				foreignTotal:
					existing.foreignTotal + row.quantity * Number(row.foreignPrice),
				totalThb: existing.totalThb + Number(row.lineTotalThb),
			});
		} else {
			productMap.set(key, {
				productName: row.productName,
				storeLocation: row.storeLocation,
				totalQty: row.quantity,
				foreignUnit: Number(row.foreignPrice),
				foreignTotal: row.quantity * Number(row.foreignPrice),
				unitThb: Number(row.unitPriceThb),
				totalThb: Number(row.lineTotalThb),
				sourceCurrency: row.sourceCurrency,
			});
		}
	}
	for (const entry of productMap.values()) {
		const added = summarySheet.addRow({
			product: entry.productName,
			totalQty: entry.totalQty,
			store: entry.storeLocation ?? "",
			foreignUnit: entry.foreignUnit,
			foreignTotal: entry.foreignTotal,
			unitThb: entry.unitThb,
			totalThb: entry.totalThb,
		});
		added.getCell("totalQty").numFmt = QTY_FMT;
		added.getCell("foreignUnit").numFmt = THB_FMT;
		added.getCell("foreignTotal").numFmt = THB_FMT;
		added.getCell("unitThb").numFmt = THB_FMT;
		added.getCell("totalThb").numFmt = THB_FMT;
	}
	applySheetStyle(summarySheet, "G");

	// ── Sheet 3: รวมยอดลูกค้า (per-customer totals) ────────────────────────────
	const customerSheet = workbook.addWorksheet(JAPAN05_SHEET_NAMES[2]);
	customerSheet.columns = [
		{ header: "ชื่อลูกค้า", key: "customer", width: 24 },
		{ header: "รวมยอด", key: "subtotal", width: 16 },
		{ header: "ค่าส่ง", key: "shipping", width: 12 },
		{ header: "รวมทั้งหมด", key: "total", width: 16 },
		{ header: "จ่ายแล้ว", key: "paid", width: 16 },
		{ header: "คงเหลือ", key: "balance", width: 16 },
		{ header: "สถานะ", key: "status", width: 16 },
	];
	const customerMap = new Map<
		string,
		{
			customerName: string;
			subtotal: number;
			shipping: number;
			total: number;
			paid: number;
			paymentStatus: string;
		}
	>();
	const seenOrderIds = new Set<string>();
	for (const row of rows) {
		if (seenOrderIds.has(row.orderId)) continue;
		seenOrderIds.add(row.orderId);
		const existing = customerMap.get(row.customerId);
		if (existing) {
			const statusPriority: Record<string, number> = {
				pending: 0,
				partial: 1,
				paid: 2,
				refunded: 3,
			};
			const worstStatus =
				(statusPriority[row.paymentStatus] ?? 0) <
				(statusPriority[existing.paymentStatus] ?? 0)
					? row.paymentStatus
					: existing.paymentStatus;
			customerMap.set(row.customerId, {
				...existing,
				subtotal: existing.subtotal + Number(row.subtotalThb),
				shipping: existing.shipping + Number(row.shippingFeeThb),
				total: existing.total + Number(row.totalThb),
				paid: existing.paid + Number(row.paidAmountThb),
				paymentStatus: worstStatus,
			});
		} else {
			customerMap.set(row.customerId, {
				customerName: row.customerName,
				subtotal: Number(row.subtotalThb),
				shipping: Number(row.shippingFeeThb),
				total: Number(row.totalThb),
				paid: Number(row.paidAmountThb),
				paymentStatus: row.paymentStatus,
			});
		}
	}
	for (const entry of customerMap.values()) {
		const balance = entry.total - entry.paid;
		const added = customerSheet.addRow({
			customer: entry.customerName,
			subtotal: entry.subtotal,
			shipping: entry.shipping,
			total: entry.total,
			paid: entry.paid,
			balance,
			status: paymentStatusLabel(entry.paymentStatus),
		});
		added.getCell("subtotal").numFmt = THB_FMT;
		added.getCell("shipping").numFmt = THB_FMT;
		added.getCell("total").numFmt = THB_FMT;
		added.getCell("paid").numFmt = THB_FMT;
		added.getCell("balance").numFmt = THB_FMT;
	}
	applySheetStyle(customerSheet, "G");

	return workbook;
}

export async function buildJapan05Workbook(
	roundId: string,
): Promise<ArrayBuffer> {
	const data = await fetchJapan05Data(roundId);
	const workbook = buildJapan05WorkbookFromData(data);
	return workbook.xlsx.writeBuffer();
}
