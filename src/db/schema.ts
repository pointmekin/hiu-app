import {
	bigserial,
	boolean,
	integer,
	jsonb,
	numeric,
	pgTable,
	text,
	timestamp,
	unique,
	uuid,
} from "drizzle-orm/pg-core";

// ─── better-auth managed tables ───────────────────────────────────────────────

export const user = pgTable("user", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: boolean("email_verified").notNull().default(false),
	image: text("image"),
	createdAt: timestamp("created_at").notNull(),
	updatedAt: timestamp("updated_at").notNull(),
});

export const session = pgTable("session", {
	id: text("id").primaryKey(),
	expiresAt: timestamp("expires_at").notNull(),
	token: text("token").notNull().unique(),
	createdAt: timestamp("created_at").notNull(),
	updatedAt: timestamp("updated_at").notNull(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
	id: text("id").primaryKey(),
	accountId: text("account_id").notNull(),
	providerId: text("provider_id").notNull(),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	idToken: text("id_token"),
	accessTokenExpiresAt: timestamp("access_token_expires_at"),
	refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
	scope: text("scope"),
	password: text("password"),
	createdAt: timestamp("created_at").notNull(),
	updatedAt: timestamp("updated_at").notNull(),
});

export const verification = pgTable("verification", {
	id: text("id").primaryKey(),
	identifier: text("identifier").notNull(),
	value: text("value").notNull(),
	expiresAt: timestamp("expires_at").notNull(),
	createdAt: timestamp("created_at"),
	updatedAt: timestamp("updated_at"),
});

// ─── App tables ───────────────────────────────────────────────────────────────

export const userRoles = pgTable("user_roles", {
	userId: text("user_id")
		.primaryKey()
		.references(() => user.id, { onDelete: "cascade" }),
	role: text("role").notNull().default("operator"),
});

export const products = pgTable("products", {
	id: uuid("id").primaryKey().defaultRandom(),
	name: text("name").notNull(),
	brand: text("brand"),
	sourceCountry: text("source_country"),
	category: text("category"),
	imageKey: text("image_key"),
	thumbKey: text("thumb_key"),
	lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

export const rounds = pgTable("rounds", {
	id: uuid("id").primaryKey().defaultRandom(),
	name: text("name").notNull(),
	country: text("country").notNull(),
	storeHint: text("store_hint"),
	purchaseStart: timestamp("purchase_start", { mode: "date" }),
	purchaseEnd: timestamp("purchase_end", { mode: "date" }),
	deliveryEta: timestamp("delivery_eta", { mode: "date" }),
	status: text("status").notNull().default("draft"),
	sourceCurrency: text("source_currency").notNull(),
	fxRate: numeric("fx_rate", { precision: 12, scale: 6 }).notNull(),
	perItemFeeTh: numeric("per_item_fee_thb", { precision: 12, scale: 2 })
		.notNull()
		.default("0"),
	defaultShippingFee: numeric("default_shipping_fee", {
		precision: 12,
		scale: 2,
	})
		.notNull()
		.default("50"),
	notes: text("notes"),
	createdBy: text("created_by").references(() => user.id),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

export const roundProducts = pgTable(
	"round_products",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		roundId: uuid("round_id")
			.notNull()
			.references(() => rounds.id, { onDelete: "cascade" }),
		productId: uuid("product_id")
			.notNull()
			.references(() => products.id),
		foreignPrice: numeric("foreign_price", {
			precision: 12,
			scale: 2,
		}).notNull(),
		sellPriceThb: numeric("sell_price_thb", {
			precision: 12,
			scale: 2,
		}).notNull(),
		priceOverridden: boolean("price_overridden").notNull().default(false),
		storeLocation: text("store_location"),
		notes: text("notes"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [unique().on(t.roundId, t.productId)],
);

export const customers = pgTable("customers", {
	id: uuid("id").primaryKey().defaultRandom(),
	displayName: text("display_name").notNull(),
	lineId: text("line_id"),
	instagramHandle: text("instagram_handle"),
	phone: text("phone"),
	notes: text("notes"),
	lastOrderedAt: timestamp("last_ordered_at", { withTimezone: true }),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

export const customerAddresses = pgTable("customer_addresses", {
	id: uuid("id").primaryKey().defaultRandom(),
	customerId: uuid("customer_id")
		.notNull()
		.references(() => customers.id, { onDelete: "cascade" }),
	recipientName: text("recipient_name").notNull(),
	mobile: text("mobile").notNull(),
	address: text("address").notNull(),
	postalCode: text("postal_code").notNull(),
	isDefault: boolean("is_default").notNull().default(false),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

export const orders = pgTable("orders", {
	id: uuid("id").primaryKey().defaultRandom(),
	roundId: uuid("round_id")
		.notNull()
		.references(() => rounds.id, { onDelete: "restrict" }),
	customerId: uuid("customer_id")
		.notNull()
		.references(() => customers.id, { onDelete: "restrict" }),
	addressId: uuid("address_id").references(() => customerAddresses.id),
	subtotalThb: numeric("subtotal_thb", { precision: 12, scale: 2 })
		.notNull()
		.default("0"),
	shippingFeeThb: numeric("shipping_fee_thb", { precision: 12, scale: 2 })
		.notNull()
		.default("50"),
	totalThb: numeric("total_thb", { precision: 12, scale: 2 })
		.notNull()
		.default("0"),
	paidAmountThb: numeric("paid_amount_thb", { precision: 12, scale: 2 })
		.notNull()
		.default("0"),
	paymentStatus: text("payment_status").notNull().default("pending"),
	kerryTracking: text("kerry_tracking"),
	status: text("status").notNull().default("active"),
	notes: text("notes"),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

export const orderItems = pgTable("order_items", {
	id: uuid("id").primaryKey().defaultRandom(),
	orderId: uuid("order_id")
		.notNull()
		.references(() => orders.id, { onDelete: "cascade" }),
	roundProductId: uuid("round_product_id")
		.notNull()
		.references(() => roundProducts.id, { onDelete: "restrict" }),
	quantity: integer("quantity").notNull(),
	unitPriceThb: numeric("unit_price_thb", {
		precision: 12,
		scale: 2,
	}).notNull(),
	lineTotalThb: numeric("line_total_thb", {
		precision: 12,
		scale: 2,
	}).notNull(),
});

export const orderPayments = pgTable("order_payments", {
	id: uuid("id").primaryKey().defaultRandom(),
	orderId: uuid("order_id")
		.notNull()
		.references(() => orders.id, { onDelete: "cascade" }),
	amountThb: numeric("amount_thb", { precision: 12, scale: 2 }).notNull(),
	type: text("type").notNull(),
	paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
	method: text("method"),
	notes: text("notes"),
	recordedBy: text("recorded_by").references(() => user.id),
});

export const appSettings = pgTable("app_settings", {
	key: text("key").primaryKey(),
	value: jsonb("value").notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

export const auditLog = pgTable("audit_log", {
	id: bigserial("id", { mode: "number" }).primaryKey(),
	userId: text("user_id").references(() => user.id),
	entity: text("entity").notNull(),
	entityId: text("entity_id").notNull(),
	action: text("action").notNull(),
	diff: jsonb("diff"),
	at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof user.$inferSelect;
export type Session = typeof session.$inferSelect;
export type UserRole = typeof userRoles.$inferSelect;
export type Round = typeof rounds.$inferSelect;
export type Product = typeof products.$inferSelect;
export type RoundProduct = typeof roundProducts.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type CustomerAddress = typeof customerAddresses.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type OrderPayment = typeof orderPayments.$inferSelect;
