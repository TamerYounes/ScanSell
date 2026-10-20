// ============================================================
// Database row types — match the Supabase schema exactly.
// These are used by the Supabase client for full type safety.
// ============================================================

export type UserRole = "owner" | "employee";
export type PaymentMethod = "Cash" | "E-transfer" | "Card" | "Other";
export type InventoryAction = "ASSIGNED" | "SOLD" | "RETURNED" | "ADJUSTED";

// ── Raw DB row shapes ────────────────────────────────────────

export interface DbProfile {
  id: string;
  full_name: string;
  role: UserRole;
  avatar_color: string;
  is_active: boolean;
  created_at: string;
}

export interface DbProduct {
  id: string;
  name: string;
  barcode: string;
  category: string;
  price: number;
  warehouse_stock: number;
  low_stock_limit: number;
  is_active: boolean;
  created_at: string;
}

export interface DbEmployeeInventory {
  id: string;
  employee_id: string;
  product_id: string;
  quantity: number;
  updated_at: string;
}

export interface DbSale {
  id: string;
  employee_id: string;
  total_amount: number;
  payment_method: PaymentMethod;
  created_at: string;
}

export interface DbSaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface DbInventoryLog {
  id: string;
  employee_id: string;
  product_id: string;
  action: InventoryAction;
  quantity_change: number;
  note: string | null;
  sale_id: string | null;
  created_at: string;
}

// Supabase client typing comes from the generated schema types.
export type { Database, Json } from "./supabase";

// ============================================================
// App-level types
// Richer shapes used by the UI — built from DB rows + joins.
// ============================================================

/** Profile with computed avatar initials (not stored in DB) */
export interface Profile extends DbProfile {
  avatarInitials: string; // derived: "SC" from "Sarah Chen"
}

/** Product with a specific employee's stock quantity attached */
export interface ProductWithStock extends DbProduct {
  stockQuantity: number; // from employee_inventory.quantity
}

/** Cart item held in local React state during a sale */
export interface CartItem {
  product: ProductWithStock;
  quantity: number;
}

/** Sale row joined with its items for display */
export interface SaleWithItems extends DbSale {
  items: DbSaleItem[];
}
