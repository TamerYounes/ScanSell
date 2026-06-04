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

// ============================================================
// Supabase Database generic type
// Used as the type parameter for createClient<Database>()
// so every .from("table") call is fully typed.
// ============================================================

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: DbProfile;
        Insert: Omit<DbProfile, "created_at"> & { created_at?: string };
        Update: Partial<Omit<DbProfile, "id">>;
      };
      products: {
        Row: DbProduct;
        Insert: Omit<DbProduct, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<DbProduct, "id" | "created_at">>;
      };
      employee_inventory: {
        Row: DbEmployeeInventory;
        Insert: Omit<DbEmployeeInventory, "id" | "updated_at"> & {
          id?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<DbEmployeeInventory, "id">>;
      };
      sales: {
        Row: DbSale;
        Insert: Omit<DbSale, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<DbSale, "id" | "created_at">>;
      };
      sale_items: {
        Row: DbSaleItem;
        Insert: Omit<DbSaleItem, "id"> & { id?: string };
        Update: Partial<Omit<DbSaleItem, "id">>;
      };
      inventory_logs: {
        Row: DbInventoryLog;
        Insert: Omit<DbInventoryLog, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<DbInventoryLog, "id" | "created_at">>;
      };
    };
    Functions: {
      complete_sale: {
        Args: { p_payment_method: string; p_items: object };
        Returns: string; // sale UUID
      };
      assign_inventory: {
        Args: {
          p_employee_id: string;
          p_product_id: string;
          p_quantity: number;
          p_note?: string;
        };
        Returns: void;
      };
      get_my_role: {
        Args: Record<string, never>;
        Returns: string;
      };
    };
  };
};

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
