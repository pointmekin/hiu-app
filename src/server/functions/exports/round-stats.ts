import { and, eq } from "drizzle-orm";
import ExcelJS from "exceljs";
import { db } from "#/db/index";
import {
	customers,
	orderItems,
	orderPayments,
	orders,
	products,
	roundProducts,
	rounds,
} from "#/db/schema";
import thPayments from "#/locales/th/payments.json";
import { PAYMENT_METHODS } from "#/shared/schemas/payment";
import { paymentStatusLabel } from "./japan05";

export const ROUND_STATS_SHEET_NAMES = {
	summary: "สรุป",
	orders: "ออเดอร์",
	items: "รายการสินค้า",
	payments: "การชำระเงิน",
	daily: "รายวัน",
} as const;

const THB_FMT = "#,##0.00";
const QTY_FMT = "#,##0";
const PCT_FMT = "0.0%";
const FX_FMT = "#,##0.000000";
const DATE_FMT = "yyyy-mm-dd";
const YES = "ใช่";
const NO_METHOD = "ไม่ระบุ";

export interface RoundStatsExportData {
	round: { name: string; sourceCurrency: string; fxRate: string };
	orders: Array<{
		id: string;
		createdAt: Date;
		customerName: string;
		paymentStatus: string;
		subtotalThb: string;
		shippingFeeThb: string;
		totalThb: string;
		paidAmountThb: string;
		isPacked: boolean;
		kerryTracking: string | null;
	}>;
	items: Array<{
		orderId: string;
		customerName: string;
		productName: string;
		quantity: number;
		unitPriceThb: string;
		lineTotalThb: string;
		foreignPrice: string;
	}>;
	payments: Array<{
		orderId: string;
		customerName: string;
		paidAt: Date;
		type: string;
		method: string | null;
		amountThb: string;
	}>;
}

export async function fetchRoundStatsExportData(
	roundId: string,
): Promise<RoundStatsExportData> {
	const activeInRound = and(
		eq(orders.roundId, roundId),
		eq(orders.status, "active"),
	);

	const [[round], orderRows, itemRows, paymentRows] = await Promise.all([
		db
			.select({
				name: rounds.name,
				sourceCurrency: rounds.sourceCurrency,
				fxRate: rounds.fxRate,
			})
			.from(rounds)
			.where(eq(rounds.id, roundId))
			.limit(1),
		db
			.select({
				id: orders.id,
				createdAt: orders.createdAt,
				customerName: customers.displayName,
				paymentStatus: orders.paymentStatus,
				subtotalThb: orders.subtotalThb,
				shippingFeeThb: orders.shippingFeeThb,
				totalThb: orders.totalThb,
				paidAmountThb: orders.paidAmountThb,
				isPacked: orders.isPacked,
				kerryTracking: orders.kerryTracking,
			})
			.from(orders)
			.innerJoin(customers, eq(orders.customerId, customers.id))
			.where(activeInRound)
			.orderBy(orders.createdAt),
		db
			.select({
				orderId: orderItems.orderId,
				customerName: customers.displayName,
				productName: products.name,
				quantity: orderItems.quantity,
				unitPriceThb: orderItems.unitPriceThb,
				lineTotalThb: orderItems.lineTotalThb,
				foreignPrice: roundProducts.foreignPrice,
			})
			.from(orderItems)
			.innerJoin(orders, eq(orderItems.orderId, orders.id))
			.innerJoin(customers, eq(orders.customerId, customers.id))
			.innerJoin(roundProducts, eq(orderItems.roundProductId, roundProducts.id))
			.innerJoin(products, eq(roundProducts.productId, products.id))
			.where(activeInRound)
			.orderBy(orders.createdAt, products.name),
		db
			.select({
				orderId: orderPayments.orderId,
				customerName: customers.displayName,
				paidAt: orderPayments.paidAt,
				type: orderPayments.type,
				method: orderPayments.method,
				amountThb: orderPayments.amountThb,
			})
			.from(orderPayments)
			.innerJoin(orders, eq(orderPayments.orderId, orders.id))
			.innerJoin(customers, eq(orders.customerId, customers.id))
			.where(activeInRound)
			.orderBy(orderPayments.paidAt),
	]);

	if (!round) throw new Error("Round not found");

	return { round, orders: orderRows, items: itemRows, payments: paymentRows };
}

// The dashboard SQL skips NaN amounts with NULLIF, so the export counts them as 0.
function toAmount(value: string): number {
	const n = Number(value);
	return Number.isFinite(n) ? n : 0;
}

function bangkokDate(date: Date): string {
	return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(
		date,
	);
}

// A real date cell, so SUMIF on the Daily sheet compares dates, not text.
function dateCell(day: string): Date {
	return new Date(`${day}T00:00:00Z`);
}

function orderRef(id: string): string {
	return id.slice(0, 8);
}

function paymentTypeLabel(type: string): string {
	return thPayments.type[type as keyof typeof thPayments.type] ?? type;
}

function paymentMethodLabel(method: string | null): string {
	if (!method) return NO_METHOD;
	return thPayments.method[method as keyof typeof thPayments.method] ?? method;
}

function ref(sheet: string, range: string): string {
	return `'${sheet}'!${range}`;
}

function formula(expression: string, result: number): ExcelJS.CellFormulaValue {
	return { formula: expression, result };
}

function applyHeaderStyle(sheet: ExcelJS.Worksheet): void {
	sheet.getRow(1).font = { bold: true };
	sheet.views = [{ state: "frozen", ySplit: 1 }];
}

function setFormats(row: ExcelJS.Row, formats: Record<string, string>): void {
	for (const [key, fmt] of Object.entries(formats)) {
		row.getCell(key).numFmt = fmt;
	}
}

export function buildRoundStatsWorkbookFromData(
	data: RoundStatsExportData,
): ExcelJS.Workbook {
	const workbook = new ExcelJS.Workbook();
	// ExcelJS drops cached results of 0, so make the viewer recalculate.
	workbook.calcProperties.fullCalcOnLoad = true;
	const fxRate = toAmount(data.round.fxRate);
	const S = ROUND_STATS_SHEET_NAMES;

	const summarySheet = workbook.addWorksheet(S.summary);

	// ── Items: one row per order item. Cost = qty × foreign price × FX. ──────
	const itemsSheet = workbook.addWorksheet(S.items);
	itemsSheet.columns = [
		{ header: "รหัสออเดอร์", key: "orderRef", width: 12 },
		{ header: "ลูกค้า", key: "customer", width: 24 },
		{ header: "สินค้า", key: "product", width: 32 },
		{ header: "จำนวน", key: "qty", width: 10 },
		{ header: "ราคาขาย/ชิ้น (฿)", key: "unitThb", width: 16 },
		{ header: "ยอดขาย (฿)", key: "lineThb", width: 16 },
		{ header: "ราคาต้นทาง/ชิ้น", key: "foreign", width: 16 },
		{ header: "สกุลเงิน", key: "currency", width: 10 },
		{ header: "อัตราแลกเปลี่ยน", key: "fx", width: 16 },
		{ header: "ต้นทุน (฿) = จำนวน × ราคาต้นทาง × อัตรา", key: "cost", width: 22 },
	];
	const costByOrder = new Map<string, number>();
	data.items.forEach((item, i) => {
		const r = i + 2;
		const foreign = toAmount(item.foreignPrice);
		const cost = item.quantity * foreign * fxRate;
		costByOrder.set(item.orderId, (costByOrder.get(item.orderId) ?? 0) + cost);
		const row = itemsSheet.addRow({
			orderRef: orderRef(item.orderId),
			customer: item.customerName,
			product: item.productName,
			qty: item.quantity,
			unitThb: toAmount(item.unitPriceThb),
			lineThb: toAmount(item.lineTotalThb),
			foreign,
			currency: data.round.sourceCurrency,
			fx: fxRate,
			cost: formula(`D${r}*G${r}*I${r}`, cost),
		});
		setFormats(row, {
			qty: QTY_FMT,
			unitThb: THB_FMT,
			lineThb: THB_FMT,
			foreign: THB_FMT,
			fx: FX_FMT,
			cost: THB_FMT,
		});
	});
	applyHeaderStyle(itemsSheet);

	// ── Orders: one row per active order. ─────────────────────────────────────
	const ordersSheet = workbook.addWorksheet(S.orders);
	ordersSheet.columns = [
		{ header: "รหัสออเดอร์", key: "orderRef", width: 12 },
		{ header: "วันที่สั่ง", key: "date", width: 12 },
		{ header: "ลูกค้า", key: "customer", width: 24 },
		{ header: "สถานะชำระ", key: "status", width: 14 },
		{ header: "ยอดสินค้า (฿)", key: "subtotal", width: 16 },
		{ header: "ค่าส่ง (฿)", key: "shipping", width: 12 },
		{ header: "รวมทั้งหมด (฿)", key: "total", width: 16 },
		{ header: "จ่ายแล้ว (฿)", key: "paid", width: 16 },
		{ header: "คงเหลือ (฿) = รวม − จ่ายแล้ว", key: "balance", width: 18 },
		{ header: "ต้นทุนสินค้า (฿)", key: "cost", width: 16 },
		{ header: "กำไรขั้นต้น (฿) = ยอดสินค้า − ต้นทุน", key: "margin", width: 20 },
		{ header: "แพ็คแล้ว", key: "packed", width: 10 },
		{ header: "เลขพัสดุ Kerry", key: "tracking", width: 18 },
	];
	const totals = {
		subtotal: 0,
		shipping: 0,
		total: 0,
		paid: 0,
		outstanding: 0,
		cost: 0,
		paidCount: 0,
		packed: 0,
		tracked: 0,
	};
	const statusTotals = new Map<string, { count: number; remaining: number }>();
	const expectedByDay = new Map<string, number>();
	data.orders.forEach((order, i) => {
		const r = i + 2;
		const subtotal = toAmount(order.subtotalThb);
		const shipping = toAmount(order.shippingFeeThb);
		const total = toAmount(order.totalThb);
		const paid = toAmount(order.paidAmountThb);
		const balance = Math.max(total - paid, 0);
		const cost = costByOrder.get(order.id) ?? 0;
		const date = bangkokDate(order.createdAt);
		const status = paymentStatusLabel(order.paymentStatus);
		const tracking = order.kerryTracking?.trim() ?? "";

		totals.subtotal += subtotal;
		totals.shipping += shipping;
		totals.total += total;
		totals.paid += paid;
		totals.outstanding += balance;
		totals.cost += cost;
		if (order.paymentStatus === "paid") totals.paidCount += 1;
		if (order.isPacked) totals.packed += 1;
		if (tracking) totals.tracked += 1;
		const bucket = statusTotals.get(status) ?? { count: 0, remaining: 0 };
		statusTotals.set(status, {
			count: bucket.count + 1,
			remaining: bucket.remaining + balance,
		});
		expectedByDay.set(date, (expectedByDay.get(date) ?? 0) + total);

		const row = ordersSheet.addRow({
			orderRef: orderRef(order.id),
			date: dateCell(date),
			customer: order.customerName,
			status,
			subtotal,
			shipping,
			total,
			paid,
			balance: formula(`MAX(G${r}-H${r},0)`, balance),
			cost: formula(
				`SUMIF(${ref(S.items, "A:A")},A${r},${ref(S.items, "J:J")})`,
				cost,
			),
			margin: formula(`E${r}-J${r}`, subtotal - cost),
			packed: order.isPacked ? YES : "",
			tracking,
		});
		setFormats(row, {
			date: DATE_FMT,
			subtotal: THB_FMT,
			shipping: THB_FMT,
			total: THB_FMT,
			paid: THB_FMT,
			balance: THB_FMT,
			cost: THB_FMT,
			margin: THB_FMT,
		});
	});
	applyHeaderStyle(ordersSheet);

	// ── Payments: one row per payment. Refunds count as negative. ─────────────
	const paymentsSheet = workbook.addWorksheet(S.payments);
	paymentsSheet.columns = [
		{ header: "วันที่ชำระ", key: "date", width: 12 },
		{ header: "รหัสออเดอร์", key: "orderRef", width: 12 },
		{ header: "ลูกค้า", key: "customer", width: 24 },
		{ header: "ประเภท", key: "type", width: 16 },
		{ header: "ช่องทาง", key: "method", width: 14 },
		{ header: "จำนวนเงิน (฿)", key: "amount", width: 16 },
		{ header: "ยอดสุทธิ (฿) (คืนเงิน = ติดลบ)", key: "net", width: 20 },
	];
	const refundLabel = paymentTypeLabel("refund");
	const netByMethod = new Map<string, number>();
	const collectedByDay = new Map<string, number>();
	data.payments.forEach((payment, i) => {
		const r = i + 2;
		const amount = toAmount(payment.amountThb);
		const net = payment.type === "refund" ? -amount : amount;
		const method = paymentMethodLabel(payment.method);
		const date = bangkokDate(payment.paidAt);
		netByMethod.set(method, (netByMethod.get(method) ?? 0) + net);
		collectedByDay.set(date, (collectedByDay.get(date) ?? 0) + net);

		const row = paymentsSheet.addRow({
			date: dateCell(date),
			orderRef: orderRef(payment.orderId),
			customer: payment.customerName,
			type: paymentTypeLabel(payment.type),
			method,
			amount,
			net: formula(`IF(D${r}="${refundLabel}",-F${r},F${r})`, net),
		});
		setFormats(row, { date: DATE_FMT, amount: THB_FMT, net: THB_FMT });
	});
	applyHeaderStyle(paymentsSheet);

	// ── Daily: per-day sums from Orders and Payments, with running totals. ────
	const dailySheet = workbook.addWorksheet(S.daily);
	dailySheet.columns = [
		{ header: "วันที่", key: "date", width: 12 },
		{ header: "มูลค่าออเดอร์ใหม่ (฿)", key: "expected", width: 20 },
		{ header: "เงินที่ได้รับ (฿)", key: "collected", width: 18 },
		{ header: "สะสม: คาดว่าจะได้ (฿)", key: "cumExpected", width: 20 },
		{ header: "สะสม: ได้รับแล้ว (฿)", key: "cumCollected", width: 20 },
	];
	const days = [
		...new Set([...expectedByDay.keys(), ...collectedByDay.keys()]),
	].sort();
	let cumExpected = 0;
	let cumCollected = 0;
	days.forEach((date, i) => {
		const r = i + 2;
		const expected = expectedByDay.get(date) ?? 0;
		const collected = collectedByDay.get(date) ?? 0;
		cumExpected += expected;
		cumCollected += collected;
		const row = dailySheet.addRow({
			date: dateCell(date),
			expected: formula(
				`SUMIF(${ref(S.orders, "B:B")},A${r},${ref(S.orders, "G:G")})`,
				expected,
			),
			collected: formula(
				`SUMIF(${ref(S.payments, "A:A")},A${r},${ref(S.payments, "G:G")})`,
				collected,
			),
			cumExpected: formula(r === 2 ? `B${r}` : `D${r - 1}+B${r}`, cumExpected),
			cumCollected: formula(
				r === 2 ? `C${r}` : `E${r - 1}+C${r}`,
				cumCollected,
			),
		});
		setFormats(row, {
			date: DATE_FMT,
			expected: THB_FMT,
			collected: THB_FMT,
			cumExpected: THB_FMT,
			cumCollected: THB_FMT,
		});
	});
	applyHeaderStyle(dailySheet);

	// ── Summary: every value is a formula over the sheets above. ──────────────
	summarySheet.columns = [
		{ header: "หัวข้อ", key: "label", width: 28 },
		{ header: "ค่า", key: "value", width: 18 },
		{ header: "วิธีคำนวณ", key: "how", width: 60 },
	];
	const O = (col: string) => ref(S.orders, `${col}:${col}`);
	const orderCount = data.orders.length;
	const collectedPct =
		totals.total > 0 ? (totals.total - totals.outstanding) / totals.total : 0;
	const margin = totals.subtotal - totals.cost;

	type SummaryValue = string | number | ExcelJS.CellFormulaValue;
	const addLine = (
		label: string,
		value: SummaryValue,
		how: string,
		fmt?: string,
	): number => {
		const row = summarySheet.addRow({ label, value, how });
		if (fmt) row.getCell("value").numFmt = fmt;
		return row.number;
	};
	const addSection = (title: string) => {
		summarySheet.addRow({});
		summarySheet.addRow({ label: title }).font = { bold: true };
	};

	addLine("รอบ", data.round.name, "");
	addLine("สกุลเงินต้นทาง", data.round.sourceCurrency, "");
	addLine("อัตราแลกเปลี่ยน", fxRate, "ใช้คำนวณต้นทุนสินค้า", FX_FMT);

	addSection("รายรับ");
	const expectedRow = addLine(
		"รายรับที่คาดว่าจะได้",
		formula(`SUM(${O("G")})`, totals.total),
		"ผลรวม 'รวมทั้งหมด' ของทุกออเดอร์ที่ใช้งานอยู่ (รวมค่าส่ง)",
		THB_FMT,
	);
	addLine(
		"ได้รับแล้ว",
		formula(`SUM(${O("H")})`, totals.paid),
		"ผลรวม 'จ่ายแล้ว' ของทุกออเดอร์",
		THB_FMT,
	);
	const outstandingRow = addLine(
		"ยอดค้างชำระ",
		formula(`SUM(${O("I")})`, totals.outstanding),
		"ผลรวม 'คงเหลือ' ของทุกออเดอร์ (ไม่ติดลบ)",
		THB_FMT,
	);
	addLine(
		"เก็บเงินแล้ว (%)",
		formula(
			`IF(B${expectedRow}=0,0,(B${expectedRow}-B${outstandingRow})/B${expectedRow})`,
			collectedPct,
		),
		"(รายรับที่คาดว่าจะได้ − ยอดค้างชำระ) ÷ รายรับที่คาดว่าจะได้",
		PCT_FMT,
	);

	addSection("กำไร");
	const salesRow = addLine(
		"ยอดขายสินค้า",
		formula(`SUM(${O("E")})`, totals.subtotal),
		"ผลรวม 'ยอดสินค้า' ของทุกออเดอร์ (ไม่รวมค่าส่ง)",
		THB_FMT,
	);
	const costRow = addLine(
		"ต้นทุนสินค้า",
		formula(`SUM(${ref(S.items, "J:J")})`, totals.cost),
		"ผลรวม 'ต้นทุน' ในชีต รายการสินค้า",
		THB_FMT,
	);
	addLine(
		"กำไรขั้นต้น",
		formula(`B${salesRow}-B${costRow}`, margin),
		"ยอดขายสินค้า − ต้นทุนสินค้า (ไม่รวมค่าส่ง เพราะไม่มีข้อมูลต้นทุนค่าส่ง Kerry)",
		THB_FMT,
	);
	addLine(
		"ค่าส่ง",
		formula(`SUM(${O("F")})`, totals.shipping),
		"ผลรวม 'ค่าส่ง' ของทุกออเดอร์",
		THB_FMT,
	);

	addSection("ออเดอร์");
	addLine(
		"จำนวนออเดอร์",
		formula(`COUNTA(${O("A")})-1`, orderCount),
		"จำนวนแถวในชีต ออเดอร์",
		QTY_FMT,
	);
	addLine(
		"ชำระครบแล้ว",
		formula(
			`COUNTIF(${O("D")},"${paymentStatusLabel("paid")}")`,
			totals.paidCount,
		),
		"จำนวนออเดอร์ที่สถานะ = ชำระแล้ว",
		QTY_FMT,
	);
	addLine(
		"แพ็คแล้ว",
		formula(`COUNTIF(${O("L")},"${YES}")`, totals.packed),
		"จำนวนออเดอร์ที่ แพ็คแล้ว = ใช่",
		QTY_FMT,
	);
	addLine(
		"มีเลขพัสดุ Kerry",
		formula(`COUNTIF(${O("M")},"?*")-1`, totals.tracked),
		"จำนวนออเดอร์ที่มีเลขพัสดุ",
		QTY_FMT,
	);

	addSection("สถานะชำระเงิน (จำนวน / คงเหลือ ฿)");
	for (const status of ["pending", "partial", "paid"] as const) {
		const label = paymentStatusLabel(status);
		const bucket = statusTotals.get(label) ?? { count: 0, remaining: 0 };
		addLine(
			`${label} — จำนวน`,
			formula(`COUNTIF(${O("D")},"${label}")`, bucket.count),
			`จำนวนออเดอร์ที่สถานะ = ${label}`,
			QTY_FMT,
		);
		addLine(
			`${label} — คงเหลือ`,
			formula(`SUMIF(${O("D")},"${label}",${O("I")})`, bucket.remaining),
			`ผลรวม 'คงเหลือ' ของออเดอร์ที่สถานะ = ${label}`,
			THB_FMT,
		);
	}

	addSection("ช่องทางชำระเงิน (ยอดสุทธิ ฿)");
	const methodLabels = [
		...PAYMENT_METHODS.map((m) => paymentMethodLabel(m)),
		...[...netByMethod.keys()].filter(
			(m) => !PAYMENT_METHODS.some((pm) => paymentMethodLabel(pm) === m),
		),
	];
	for (const label of methodLabels) {
		addLine(
			label,
			formula(
				`SUMIF(${ref(S.payments, "E:E")},"${label}",${ref(S.payments, "G:G")})`,
				netByMethod.get(label) ?? 0,
			),
			`ผลรวม 'ยอดสุทธิ' ในชีต การชำระเงิน ที่ช่องทาง = ${label}`,
			THB_FMT,
		);
	}
	applyHeaderStyle(summarySheet);

	return workbook;
}

export async function buildRoundStatsWorkbook(
	roundId: string,
): Promise<{ name: string; buffer: ArrayBuffer }> {
	const data = await fetchRoundStatsExportData(roundId);
	const workbook = buildRoundStatsWorkbookFromData(data);
	return { name: data.round.name, buffer: await workbook.xlsx.writeBuffer() };
}
