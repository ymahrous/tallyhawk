import { describe, it, expect } from "vitest";
import {
  SUPPORTED_CURRENCIES,
  formatCurrency,
  getCurrencySymbol,
  getCurrencyInfo,
  getCurrenciesByRegion,
  formatDualCurrency,
  isValidCurrency,
} from "./currency";

describe("formatCurrency", () => {
  it("formats an amount with the given currency, not a hardcoded USD", () => {
    expect(formatCurrency(100, "USD")).toContain("100.00");
    expect(formatCurrency(100, "EUR")).toContain("100.00");
    expect(formatCurrency(100, "USD")).not.toEqual(formatCurrency(100, "EUR"));
  });

  it("always renders exactly two fraction digits", () => {
    expect(formatCurrency(5, "USD")).toContain("5.00");
    expect(formatCurrency(5.129, "USD")).toContain("5.13");
  });

  it("handles zero and negative amounts", () => {
    expect(formatCurrency(0, "USD")).toContain("0.00");
    expect(formatCurrency(-42.5, "USD")).toContain("42.50");
  });
});

describe("getCurrencySymbol", () => {
  it("returns the configured symbol for a supported currency", () => {
    expect(getCurrencySymbol("USD")).toBe("$");
    expect(getCurrencySymbol("EUR")).toBe("€");
    expect(getCurrencySymbol("GBP")).toBe("£");
  });

  it("falls back to the code itself when the currency is unknown", () => {
    // Deliberately bypassing the type to mimic an unexpected API value.
    expect(getCurrencySymbol("XYZ" as never)).toBe("XYZ");
  });
});

describe("getCurrencyInfo", () => {
  it("returns the full record for a supported currency", () => {
    expect(getCurrencyInfo("JPY")).toEqual({
      code: "JPY",
      symbol: "¥",
      name: "Japanese Yen",
      region: "Asia-Pacific",
    });
  });

  it("returns undefined for an unsupported currency", () => {
    expect(getCurrencyInfo("XYZ" as never)).toBeUndefined();
  });
});

describe("getCurrenciesByRegion", () => {
  it("groups every supported currency under its region", () => {
    const grouped = getCurrenciesByRegion();
    const total = Object.values(grouped).reduce((sum, list) => sum + list.length, 0);
    expect(total).toBe(SUPPORTED_CURRENCIES.length);
  });

  it("places currencies in the region declared on the record", () => {
    const grouped = getCurrenciesByRegion();
    expect(grouped["Europe"].map((c) => c.code)).toContain("EUR");
    expect(grouped["Americas"].map((c) => c.code)).toContain("USD");
  });
});

describe("formatDualCurrency", () => {
  it("shows the original amount converting into the target currency", () => {
    const result = formatDualCurrency(100, "EUR", 108.5, "USD");
    expect(result).toContain("→");
    expect(result).toContain("100.00");
    expect(result).toContain("108.50");
  });
});

describe("isValidCurrency", () => {
  it("accepts supported ISO codes", () => {
    expect(isValidCurrency("USD")).toBe(true);
    expect(isValidCurrency("KES")).toBe(true);
  });

  it("rejects unsupported or malformed codes", () => {
    expect(isValidCurrency("XYZ")).toBe(false);
    expect(isValidCurrency("usd")).toBe(false);
    expect(isValidCurrency("")).toBe(false);
  });
});
