// Generated from the database schema (Supabase type generator). Regenerate
// after a migration instead of editing by hand.
//
// One manual change after generating: role, payment_method and action are
// text columns limited by CHECK constraints, so they're narrowed to those
// values below (Role, PaymentMethodValue, InventoryActionValue).

type Role = "owner" | "employee"
type PaymentMethodValue = "Cash" | "E-transfer" | "Card" | "Other"
type InventoryActionValue = "ASSIGNED" | "SOLD" | "RETURNED" | "ADJUSTED"

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      employee_inventory: {
        Row: {
          employee_id: string
          id: string
          product_id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          employee_id: string
          id?: string
          product_id: string
          quantity?: number
          updated_at?: string
        }
        Update: {
          employee_id?: string
          id?: string
          product_id?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_inventory_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_logs: {
        Row: {
          action: InventoryActionValue
          created_at: string
          employee_id: string
          id: string
          note: string | null
          product_id: string
          quantity_change: number
          sale_id: string | null
        }
        Insert: {
          action: InventoryActionValue
          created_at?: string
          employee_id: string
          id?: string
          note?: string | null
          product_id: string
          quantity_change: number
          sale_id?: string | null
        }
        Update: {
          action?: InventoryActionValue
          created_at?: string
          employee_id?: string
          id?: string
          note?: string | null
          product_id?: string
          quantity_change?: number
          sale_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_logs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_logs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_logs_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string
          category: string
          created_at: string
          id: string
          is_active: boolean
          low_stock_limit: number
          name: string
          price: number
          warehouse_stock: number
        }
        Insert: {
          barcode: string
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          low_stock_limit?: number
          name: string
          price: number
          warehouse_stock?: number
        }
        Update: {
          barcode?: string
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          low_stock_limit?: number
          name?: string
          price?: number
          warehouse_stock?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_color: string
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          role: Role
        }
        Insert: {
          avatar_color?: string
          created_at?: string
          full_name?: string
          id: string
          is_active?: boolean
          role?: Role
        }
        Update: {
          avatar_color?: string
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          role?: Role
        }
        Relationships: []
      }
      sale_items: {
        Row: {
          id: string
          product_id: string
          quantity: number
          sale_id: string
          subtotal: number
          unit_price: number
        }
        Insert: {
          id?: string
          product_id: string
          quantity: number
          sale_id: string
          subtotal: number
          unit_price: number
        }
        Update: {
          id?: string
          product_id?: string
          quantity?: number
          sale_id?: string
          subtotal?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          payment_method: PaymentMethodValue
          total_amount: number
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          payment_method: PaymentMethodValue
          total_amount: number
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          payment_method?: PaymentMethodValue
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assign_inventory: {
        Args: {
          p_employee_id: string
          p_note?: string
          p_product_id: string
          p_quantity: number
        }
        Returns: undefined
      }
      complete_sale: {
        Args: { p_items: Json; p_payment_method: string }
        Returns: string
      }
      get_my_role: { Args: never; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
