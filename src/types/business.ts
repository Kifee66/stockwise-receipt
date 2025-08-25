import { z } from "zod";

export type UUID = string;

export type PaymentMethod = "cash" | "mpesa" | "card" | "other";

export interface Product {
  id: UUID;
  name: string;
  sku: string;
  barcode?: string | null;
  category?: string | null;
  cost_price: number; // per unit
  selling_price: number; // per unit
  current_stock: number;
  low_stock_threshold?: number;
  created_at: string; // ISO
  updated_at: string; // ISO
}

export interface SaleItem {
  product_id: UUID;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface Receipt {
  id: UUID;
  sale_id: UUID;
  number: string; // human-readable receipt number
  issued_at: string; // ISO
  total: number;
  payment_method: PaymentMethod;
}

export interface Customer {
  id?: UUID;
  name?: string;
  phone?: string;
}

export interface Sale {
  id: UUID;
  date: string; // ISO
  items: SaleItem[];
  total_amount: number;
  payment_method: PaymentMethod;
  staff_id?: UUID | null;
  customer?: Customer | null;
  receipt?: Receipt | null;
}

export type StockMovementType = "restock" | "sale" | "adjustment";

export interface StockMovement {
  id: UUID;
  product_id: UUID;
  quantity: number; // positive for in, negative for out
  type: StockMovementType;
  date: string; // ISO
  notes?: string | null;
  supplier_id?: UUID | null;
}

export type AppRole = "admin" | "manager" | "cashier" | "viewer";

export interface Staff {
  id: UUID;
  name: string;
  email: string;
  role: AppRole;
  created_at: string; // ISO
}

export interface BackupPreferences {
  enabled: boolean;
  frequency: "daily" | "weekly" | "monthly";
  last_run_at?: string | null;
}

export interface BusinessSettings {
  id: UUID; // singleton per client
  business_name: string;
  default_currency: string; // e.g. KES
  timezone: string; // IANA
  backup: BackupPreferences;
  created_at: string; // ISO
  updated_at: string; // ISO
}

// Zod Schemas for validation
export const productSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  sku: z.string().min(1),
  barcode: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  cost_price: z.number().nonnegative(),
  selling_price: z.number().nonnegative(),
  current_stock: z.number().int(),
  low_stock_threshold: z.number().int().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const saleItemSchema = z.object({
  product_id: z.string().uuid(),
  product_name: z.string().min(1),
  quantity: z.number().int().positive(),
  unit_price: z.number().nonnegative(),
  subtotal: z.number().nonnegative(),
});

export const receiptSchema = z.object({
  id: z.string().uuid(),
  sale_id: z.string().uuid(),
  number: z.string().min(1),
  issued_at: z.string(),
  total: z.number().nonnegative(),
  payment_method: z.enum(["cash", "mpesa", "card", "other"]),
});

export const saleSchema = z.object({
  id: z.string().uuid(),
  date: z.string(),
  items: z.array(saleItemSchema).min(1),
  total_amount: z.number().nonnegative(),
  payment_method: z.enum(["cash", "mpesa", "card", "other"]),
  staff_id: z.string().uuid().optional().nullable(),
  customer: z
    .object({ id: z.string().uuid().optional(), name: z.string().optional(), phone: z.string().optional() })
    .optional()
    .nullable(),
  receipt: receiptSchema.optional().nullable(),
});

export const stockMovementSchema = z.object({
  id: z.string().uuid(),
  product_id: z.string().uuid(),
  quantity: z.number().int(),
  type: z.enum(["restock", "sale", "adjustment"]),
  date: z.string(),
  notes: z.string().optional().nullable(),
  supplier_id: z.string().uuid().optional().nullable(),
});

export const staffSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["admin", "manager", "cashier", "viewer"]),
  created_at: z.string(),
});

export const settingsSchema = z.object({
  id: z.string().uuid(),
  business_name: z.string().min(1),
  default_currency: z.string().min(1),
  timezone: z.string().min(1),
  backup: z.object({
    enabled: z.boolean(),
    frequency: z.enum(["daily", "weekly", "monthly"]),
    last_run_at: z.string().optional().nullable(),
  }),
  created_at: z.string(),
  updated_at: z.string(),
});

export type StoreName =
  | "products"
  | "sales"
  | "stock_movements"
  | "staff"
  | "business_settings";
