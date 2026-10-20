/**
 * A seller is running low at 2 units or fewer. Products have their own
 * low_stock_limit, but that's sized for the warehouse (10 cables, say), so
 * it would flag almost everything a seller carries.
 */
export const SELLER_LOW_AT = 2;

export type StockLevel = "out" | "low" | "ok";

export function sellerStockLevel(quantity: number): StockLevel {
  if (quantity <= 0) return "out";
  if (quantity <= SELLER_LOW_AT) return "low";
  return "ok";
}

export function warehouseStockLevel(product: {
  warehouse_stock: number;
  low_stock_limit: number;
}): StockLevel {
  if (product.warehouse_stock <= 0) return "out";
  if (product.warehouse_stock <= product.low_stock_limit) return "low";
  return "ok";
}
