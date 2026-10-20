import { normalizeBarcode, validateBarcode } from "./barcode";

export type ProductForm = {
  name: string;
  barcode: string;
  category: string;
  price: string;
  warehouseStock: string;
  lowStockLimit: string;
};

export type ProductInput = {
  name: string;
  barcode: string;
  category: string;
  price: number;
  warehouse_stock: number;
  low_stock_limit: number;
};

export type ProductFormErrors = Partial<Record<keyof ProductForm, string>>;

export const emptyProductForm: ProductForm = {
  name: "",
  barcode: "",
  category: "General",
  price: "",
  warehouseStock: "0",
  lowStockLimit: "5",
};

function wholeNumber(value: string) {
  return /^\d+$/.test(value.trim()) ? Number(value.trim()) : null;
}

/** Turns the form's text fields into a product row, or field errors. */
export function parseProductForm(
  form: ProductForm,
): { ok: true; product: ProductInput } | { ok: false; errors: ProductFormErrors } {
  const errors: ProductFormErrors = {};

  const name = form.name.trim();
  if (!name) errors.name = "Name is required.";
  else if (name.length > 120) errors.name = "Name is too long.";

  const barcodeError = validateBarcode(form.barcode);
  if (barcodeError) errors.barcode = barcodeError;

  const priceText = form.price.trim().replace(/^\$/, "");
  const price = /^\d+(\.\d{1,2})?$/.test(priceText) ? Number(priceText) : null;
  if (price === null) errors.price = "Enter a price like 12 or 12.50.";
  else if (price > 99_999_999.99) errors.price = "Price is too high.";

  const warehouseStock = wholeNumber(form.warehouseStock);
  if (warehouseStock === null) errors.warehouseStock = "Enter a whole number, 0 or more.";

  const lowStockLimit = wholeNumber(form.lowStockLimit);
  if (lowStockLimit === null) errors.lowStockLimit = "Enter a whole number, 0 or more.";

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    product: {
      name,
      barcode: normalizeBarcode(form.barcode),
      category: form.category.trim() || "General",
      price: price!,
      warehouse_stock: warehouseStock!,
      low_stock_limit: lowStockLimit!,
    },
  };
}
