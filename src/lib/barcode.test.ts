import { describe, expect, it } from "vitest";
import { hasValidCheckDigit, normalizeBarcode, validateBarcode } from "./barcode";

describe("hasValidCheckDigit", () => {
  it("accepts real UPC-A, EAN-13 and EAN-8 codes", () => {
    expect(hasValidCheckDigit("036000291452")).toBe(true); // UPC-A
    expect(hasValidCheckDigit("4006381333931")).toBe(true); // EAN-13
    expect(hasValidCheckDigit("96385074")).toBe(true); // EAN-8
  });

  it("rejects a wrong check digit", () => {
    expect(hasValidCheckDigit("036000291453")).toBe(false);
    expect(hasValidCheckDigit("4006381333932")).toBe(false);
  });

  it("rejects other lengths and non-digits", () => {
    expect(hasValidCheckDigit("12345")).toBe(false);
    expect(hasValidCheckDigit("03600029145A")).toBe(false);
  });
});

describe("validateBarcode", () => {
  it("allows short internal codes without a check digit", () => {
    expect(validateBarcode("SKU42")).toBeNull();
    expect(validateBarcode("001")).toBeNull();
  });

  it("checks codes that look like UPC/EAN numbers", () => {
    expect(validateBarcode("036000291452")).toBeNull();
    expect(validateBarcode("036000291453")).toMatch(/check digit/);
  });

  it("ignores spaces and dashes", () => {
    expect(normalizeBarcode(" 0360-0029 1452 ")).toBe("036000291452");
    expect(validateBarcode("0 36000 29145 2")).toBeNull();
  });

  it("rejects empty, too long and symbol-filled codes", () => {
    expect(validateBarcode("  ")).toBe("Barcode is required.");
    expect(validateBarcode("A".repeat(33))).toBe("Barcode is too long.");
    expect(validateBarcode("abc$123")).toMatch(/letters and numbers/);
  });
});
