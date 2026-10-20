import { describe, expect, it } from "vitest";
import { sellerStockLevel, warehouseStockLevel } from "./stock";

describe("sellerStockLevel", () => {
  it("is out at zero, low at 1 or 2, fine above that", () => {
    expect(sellerStockLevel(0)).toBe("out");
    expect(sellerStockLevel(1)).toBe("low");
    expect(sellerStockLevel(2)).toBe("low");
    expect(sellerStockLevel(3)).toBe("ok");
  });
});

describe("warehouseStockLevel", () => {
  it("uses the product's own warning level", () => {
    expect(warehouseStockLevel({ warehouse_stock: 0, low_stock_limit: 10 })).toBe("out");
    expect(warehouseStockLevel({ warehouse_stock: 10, low_stock_limit: 10 })).toBe("low");
    expect(warehouseStockLevel({ warehouse_stock: 11, low_stock_limit: 10 })).toBe("ok");
  });
});
