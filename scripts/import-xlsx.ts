#!/usr/bin/env bun
/**
 * One-off backfill script — import an in-flight round from the "Japan 2" sheet.
 *
 * Sheet: "Japan 2" (or first sheet if not found)
 * Columns:
 *   A: Running number (ignored)
 *   B: Line ID — used as customer identifier and display name (e.g. "Pomme")
 *   C: Product name (e.g. "elixir balance")
 *   D: Quantity
 *   E: Unit price (THB sell price per item)
 *   F: Line total (THB) = D × E
 *
 * All rows with the same Line ID are grouped into one order.
 * Imported orders default to paymentStatus = "pending".
 *
 * Usage:
 *   bun run scripts/import-xlsx.ts --file japan2.xlsx --round-id <uuid> [--dry-run]
 */

import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { config } from "dotenv";

config({ path: [".env.local", ".env"] });

const { values } = parseArgs({
	args: process.argv.slice(2),
	options: {
		file: { type: "string" },
		"round-id": { type: "string" },
		"dry-run": { type: "boolean", default: false },
		help: { type: "boolean", default: false },
	},
	strict: true,
});

if (values.help || !values.file || !values["round-id"]) {
	console.log(`
Usage: bun run scripts/import-xlsx.ts --file <path> --round-id <uuid> [--dry-run]

Options:
  --file       Path to the source Excel file (.xlsx) containing a "Japan 2" sheet
  --round-id   UUID of the round to import into (must already exist in the DB)
  --dry-run    Parse and preview without writing to the database
  --help       Show this help message

Column layout expected in "Japan 2" sheet:
  A: Row number (ignored)
  B: Line ID / customer handle (e.g. "Pomme")
  C: Product name (e.g. "elixir balance")
  D: Quantity
  E: Unit price THB
  F: Line total THB (D × E)
`);
	process.exit(values.help ? 0 : 1);
}

const filePath = path.resolve(values.file!);
const roundId = values["round-id"]!;
const dryRun = values["dry-run"]!;

if (!fs.existsSync(filePath)) {
	console.error(`File not found: ${filePath}`);
	process.exit(1);
}

console.log(`Importing from: ${filePath}`);
console.log(`Target round:   ${roundId}`);
if (dryRun) console.log("DRY RUN — no DB writes");
console.log();

const ExcelJS = (await import("exceljs")).default;
const { db } = await import("../src/db/index");
const { eq } = await import("drizzle-orm");
const { rounds, customers, products, roundProducts, orders, orderItems } = await import(
	"../src/db/schema"
);

// ── 1. Verify round ───────────────────────────────────────────────────────────
const [round] = await db.select().from(rounds).where(eq(rounds.id, roundId));
if (!round) {
	console.error(`Round not found: ${roundId}`);
	process.exit(1);
}
console.log(`Round: ${round.name} (${round.sourceCurrency} @ ${round.fxRate})`);
console.log();

// ── 2. Parse sheet ────────────────────────────────────────────────────────────
const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(filePath);

const sheet =
	workbook.getWorksheet("Japan 2") ??
	workbook.getWorksheet("Japan2") ??
	workbook.worksheets[0];

if (!sheet) {
	console.error('No sheet found. Expected "Japan 2".');
	process.exit(1);
}

console.log(`Reading sheet: "${sheet.name}" (${sheet.rowCount - 1} data rows)`);

interface ParsedRow {
	lineId: string;       // col B — customer identifier
	productName: string;  // col C
	qty: number;          // col D
	unitPriceThb: number; // col E
	lineTotalThb: number; // col F
}

const parsedRows: ParsedRow[] = [];
let skipped = 0;

function cellNum(cell: import("exceljs").Cell): number {
	const v = cell.value;
	if (v === null || v === undefined) return 0;
	if (typeof v === "object" && "result" in v) return Number((v as { result: unknown }).result ?? 0);
	return Number(v);
}

sheet.eachRow((row, rowNumber) => {
	if (rowNumber === 1) return; // header

	const lineId = String(row.getCell(2).value ?? "").trim();        // B
	const productName = String(row.getCell(3).value ?? "").trim();   // C
	const qty = cellNum(row.getCell(4));                              // D
	const unitPriceThb = cellNum(row.getCell(5));                    // E
	const lineTotalThb = cellNum(row.getCell(6));                    // F

	if (!lineId || !productName || qty <= 0) {
		skipped++;
		return;
	}

	parsedRows.push({ lineId, productName, qty, unitPriceThb, lineTotalThb });
});

console.log(`Parsed ${parsedRows.length} rows (skipped ${skipped} invalid)`);
console.log();

if (parsedRows.length === 0) {
	console.error("No valid rows found. Check the sheet format.");
	process.exit(1);
}

// ── 3. Preview ────────────────────────────────────────────────────────────────
const uniqueLineIds = [...new Set(parsedRows.map((r) => r.lineId))];
const uniqueProducts = [...new Set(parsedRows.map((r) => r.productName))];

const preview5 = (arr: string[]) =>
	arr.slice(0, 5).join(", ") + (arr.length > 5 ? ` … (+${arr.length - 5})` : "");

console.log(`Customers (${uniqueLineIds.length}):  ${preview5(uniqueLineIds)}`);
console.log(`Products  (${uniqueProducts.length}): ${preview5(uniqueProducts)}`);
console.log();

if (dryRun) {
	console.log("DRY RUN complete — no data written.");
	process.exit(0);
}

// ── 4. Upsert customers (matched by lineId) ───────────────────────────────────
console.log("Upserting customers...");
const customerIdMap = new Map<string, string>();

for (const lineId of uniqueLineIds) {
	// Try matching existing customer by lineId
	const [existing] = await db
		.select({ id: customers.id })
		.from(customers)
		.where(eq(customers.lineId, lineId));

	if (existing) {
		customerIdMap.set(lineId, existing.id);
	} else {
		const [inserted] = await db
			.insert(customers)
			.values({ displayName: lineId, lineId })
			.returning({ id: customers.id });
		customerIdMap.set(lineId, inserted.id);
		console.log(`  + Customer: ${lineId}`);
	}
}

// ── 5. Upsert products & round_products ──────────────────────────────────────
console.log("Upserting products and round_products...");
const roundProductIdMap = new Map<string, string>();

for (const productName of uniqueProducts) {
	const sample = parsedRows.find((r) => r.productName === productName)!;

	let productId: string;
	const [existingProduct] = await db
		.select({ id: products.id })
		.from(products)
		.where(eq(products.name, productName));

	if (existingProduct) {
		productId = existingProduct.id;
	} else {
		const [inserted] = await db
			.insert(products)
			.values({ name: productName })
			.returning({ id: products.id });
		productId = inserted.id;
		console.log(`  + Product: ${productName}`);
	}

	// Back-compute foreign price: (sellPrice - perItemFee) / fxRate
	const fxRate = Number(round.fxRate);
	const perItemFee = Number(round.perItemFeeTh);
	const foreignPrice = fxRate > 0 ? (sample.unitPriceThb - perItemFee) / fxRate : 0;

	const [rp] = await db
		.insert(roundProducts)
		.values({
			roundId,
			productId,
			foreignPrice: foreignPrice.toFixed(2),
			sellPriceThb: sample.unitPriceThb.toFixed(2),
			priceOverridden: true,
		})
		.onConflictDoUpdate({
			target: [roundProducts.roundId, roundProducts.productId],
			set: { sellPriceThb: sample.unitPriceThb.toFixed(2) },
		})
		.returning({ id: roundProducts.id });

	roundProductIdMap.set(productName, rp.id);
}

// ── 6. Create orders grouped by Line ID ───────────────────────────────────────
console.log("Creating orders...");
const rowsByLineId = new Map<string, ParsedRow[]>();
for (const row of parsedRows) {
	const existing = rowsByLineId.get(row.lineId) ?? [];
	rowsByLineId.set(row.lineId, [...existing, row]);
}

let orderCount = 0;
let itemCount = 0;

for (const [lineId, customerRows] of rowsByLineId) {
	const customerId = customerIdMap.get(lineId)!;
	const subtotal = customerRows.reduce((sum, r) => sum + r.lineTotalThb, 0);
	const shippingFee = Number(round.defaultShippingFee);

	const [order] = await db
		.insert(orders)
		.values({
			roundId,
			customerId,
			subtotalThb: subtotal.toFixed(2),
			shippingFeeThb: shippingFee.toFixed(2),
			totalThb: (subtotal + shippingFee).toFixed(2),
			paymentStatus: "pending",
		})
		.returning({ id: orders.id });

	orderCount++;

	for (const row of customerRows) {
		await db.insert(orderItems).values({
			orderId: order.id,
			roundProductId: roundProductIdMap.get(row.productName)!,
			quantity: row.qty,
			unitPriceThb: row.unitPriceThb.toFixed(2),
			lineTotalThb: row.lineTotalThb.toFixed(2),
		});
		itemCount++;
	}
}

console.log();
console.log("✓ Import complete");
console.log(`  Orders:    ${orderCount}`);
console.log(`  Items:     ${itemCount}`);
console.log(`  Customers: ${uniqueLineIds.length}`);
console.log(`  Products:  ${uniqueProducts.length}`);
process.exit(0);
