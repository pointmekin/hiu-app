import { z } from "zod";

export const ORDER_STATUSES = ["active", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = [
	"pending",
	"partial",
	"paid",
	"refunded",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const orderItemInputSchema = z.object({
	roundProductId: z.string().uuid(),
	quantity: z.number().int().positive(),
	unitPriceThb: z.number().positive(),
});

export type OrderItemInput = z.infer<typeof orderItemInputSchema>;

export const createOrderSchema = z.object({
	roundId: z.string().uuid(),
	customerId: z.string().uuid(),
	addressId: z.string().uuid().optional(),
	shippingFeeThb: z.number().min(0),
	notes: z.string().optional(),
	items: z.array(orderItemInputSchema).min(1),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const updateOrderSchema = z.object({
	id: z.string().uuid(),
	customerId: z.string().uuid().optional(),
	addressId: z.string().uuid().optional().nullable(),
	shippingFeeThb: z.number().min(0).optional(),
	notes: z.string().optional().nullable(),
	kerryTracking: z.string().optional().nullable(),
	items: z.array(orderItemInputSchema).min(1).optional(),
});

export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;

export const listOrdersSchema = z.object({
	roundId: z.string().uuid(),
	paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
	status: z.enum(ORDER_STATUSES).optional(),
});

export type ListOrdersInput = z.infer<typeof listOrdersSchema>;
