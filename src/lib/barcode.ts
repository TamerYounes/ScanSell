/** Strips spaces and dashes that people type or scanners sometimes add. */
export function normalizeBarcode(value: string) {
  return value.replace(/[\s-]/g, "");
}

/**
 * Checks the last digit of an EAN-8, UPC-A (12 digits) or EAN-13 code.
 * Weights alternate 3 and 1 starting from the digit next to the check digit.
 */
export function hasValidCheckDigit(code: string) {
  if (!/^\d+$/.test(code) || ![8, 12, 13].includes(code.length)) {
    return false;
  }

  const digits = code.split("").map(Number);
  const check = digits.pop()!;
  const sum = digits
    .reverse()
    .reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);

  return (10 - (sum % 10)) % 10 === check;
}

/**
 * Store-printed or internal labels can be any short code, so only codes that
 * look like retail UPC/EAN numbers get their check digit verified.
 */
export function validateBarcode(value: string): string | null {
  const code = normalizeBarcode(value);

  if (!code) {
    return "Barcode is required.";
  }
  if (code.length > 32) {
    return "Barcode is too long.";
  }
  if (!/^[A-Za-z0-9]+$/.test(code)) {
    return "Barcode can only contain letters and numbers.";
  }
  if (/^\d+$/.test(code) && [8, 12, 13].includes(code.length) && !hasValidCheckDigit(code)) {
    return "That UPC/EAN number has a wrong check digit. Check for a typo.";
  }

  return null;
}
