import { describe, expect, it } from "vitest";
import { emptyProductForm, parseProductForm } from "./products";

const valid = {
  ...emptyProductForm,
  name: "  Stoneware mug ",
  barcode: "0360-0029-1452",
  category: "",
  price: "$12.5",
  warehouseStock: "40",
  lowStockLimit: "3",
};

describe("parseProductForm", () => {
  it("trims and converts a valid form", () => {
    expect(parseProductForm(valid)).toEqual({
      ok: true,
      product: {
        name: "Stoneware mug",
        barcode: "036000291452",
        category: "General",
        price: 12.5,
        warehouse_stock: 40,
        low_stock_limit: 3,
      },
    });
  });

  it("reports every invalid field at once", () => {
    const result = parseProductForm({
      ...valid,
      name: "",
      barcode: "036000291453",
      price: "12.345",
      warehouseStock: "-1",
      lowStockLimit: "2.5",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual([
        "barcode",
        "lowStockLimit",
        "name",
        "price",
        "warehouseStock",
      ]);
    }
  });

  it("accepts whole-dollar prices and zero stock", () => {
    const result = parseProductForm({ ...valid, price: "20", warehouseStock: "0" });

    expect(result.ok && result.product.price).toBe(20);
    expect(result.ok && result.product.warehouse_stock).toBe(0);
  });
});
