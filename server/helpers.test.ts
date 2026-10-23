// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { detectMimeType, parseModelJson } from "./ai";
import { effectiveDate, parseAmount, parseAmountOr, parseInvoiceDate, reliableAmount } from "./amounts";
import { convertCurrency, round, VALID_CURRENCIES } from "./currency";
import { qbAccountFor, toQbDate } from "./quickbooks";
import { money, toCsv } from "./tax-summary";
import { currentMonth } from "./usage";
import { stubFetch } from "@/test/server";

describe("parseAmount", () => {
  it("strips currency symbols and thousands separators", () => {
    expect(parseAmount("$1,250.00")).toBe(1250);
    expect(parseAmount("-€12.5")).toBe(-12.5);
    expect(parseAmount(42)).toBe(42);
    expect(parseAmount("")).toBe(0);
    expect(parseAmount(null)).toBe(0);
  });

  it("throws on leftovers that aren't a number, like Python's float()", () => {
    expect(() => parseAmount("1.2.3")).toThrow();
    expect(() => parseAmount("--")).toThrow();
    expect(parseAmountOr("1.2.3", 7)).toBe(7);
    expect(parseAmountOr("$3")).toBe(3);
  });
});

describe("reliableAmount", () => {
  it("only trusts amounts converted into the current base currency", () => {
    expect(reliableAmount({ convertedAmount: 10, convertedCurrency: "USD" }, "USD")).toBe(10);
    expect(reliableAmount({ convertedAmount: 10, convertedCurrency: "EUR" }, "USD")).toBeNull();
    expect(reliableAmount({ convertedAmount: null, convertedCurrency: null }, "USD")).toBeNull();
  });
});

describe("parseInvoiceDate", () => {
  const d = (s: string) => parseInvoiceDate({ date: s })?.toISOString().slice(0, 10) ?? null;

  it("accepts the four supported formats and ignores time parts", () => {
    expect(d("2026-03-05")).toBe("2026-03-05");
    expect(d("2026-3-5T10:00:00")).toBe("2026-03-05");
    expect(d("03/05/2026")).toBe("2026-03-05"); // month first wins when ambiguous
    expect(d("25/12/2026")).toBe("2026-12-25"); // falls back to day first
    expect(d("2026/12/25 09:00")).toBe("2026-12-25");
  });

  it("rejects missing or impossible dates", () => {
    expect(d("2026-02-30")).toBeNull();
    expect(d("yesterday")).toBeNull();
    expect(parseInvoiceDate(null)).toBeNull();
    expect(parseInvoiceDate({})).toBeNull();
  });

  it("falls back to the upload date", () => {
    const uploaded = new Date("2026-01-02T00:00:00Z");
    expect(effectiveDate({ date: "nope" }, uploaded)).toBe(uploaded);
  });
});

describe("currency", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("knows the supported ISO codes", () => {
    expect(VALID_CURRENCIES.has("EUR")).toBe(true);
    expect(VALID_CURRENCIES.size).toBe(40);
    expect(VALID_CURRENCIES.has("XXX")).toBe(false);
  });

  it("treats same-currency as a real 1:1 rate", async () => {
    expect(await convertCurrency(5, "USD", "USD")).toEqual({ amount: 5, rate: 1 });
  });

  it("returns a null rate without an API key (never a fabricated 1.0)", async () => {
    vi.stubEnv("EXCHANGE_RATE_API_KEY", "");
    expect(await convertCurrency(5, "EUR", "USD")).toEqual({ amount: 5, rate: null });
  });

  it("uses exchangerate-api pair conversion", async () => {
    vi.stubEnv("EXCHANGE_RATE_API_KEY", "k");
    const fetchMock = stubFetch(() => Response.json({ result: "success", conversion_result: 10.85, conversion_rate: 1.085 }));
    expect(await convertCurrency(10, "EUR", "USD")).toEqual({ amount: 10.85, rate: 1.085 });
    expect(fetchMock.mock.calls[0][0]).toBe("https://v6.exchangerate-api.com/v6/k/pair/EUR/USD/10");
  });

  it("returns a null rate on API errors and failures", async () => {
    vi.stubEnv("EXCHANGE_RATE_API_KEY", "k");
    stubFetch(() => Response.json({ result: "error", "error-type": "unsupported-code" }));
    expect((await convertCurrency(10, "EUR", "USD")).rate).toBeNull();
    stubFetch(() => new Response("boom", { status: 500 }));
    expect((await convertCurrency(10, "EUR", "USD")).rate).toBeNull();
  });

  it("rounds half away from zero at cents", () => {
    expect(round(1.005, 2)).toBe(1.01);
    expect(round(1.0849999, 6)).toBe(1.085);
  });
});

describe("usage month key", () => {
  it("is midnight UTC on the first of the month", () => {
    expect(currentMonth(new Date("2026-10-23T18:30:00Z")).toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });
});

describe("QuickBooks helpers", () => {
  it("normalises dates to YYYY-MM-DD or leaves them for QB to default", () => {
    expect(toQbDate("2026-03-05")).toBe("2026-03-05");
    expect(toQbDate("March 5, 2026")).toBe("2026-03-05");
    expect(toQbDate("Smarch 5, 2026")).toBeNull();
    expect(toQbDate("February 30, 2026")).toBeNull();
    expect(toQbDate("")).toBeNull();
  });

  it("maps categories onto default expense accounts", () => {
    expect(qbAccountFor("Travel").value).toBe("13");
    expect(qbAccountFor("Meals").value).toBe("24");
    expect(qbAccountFor("Software").value).toBe("56");
    expect(qbAccountFor("Office Supplies").value).toBe("28");
    expect(qbAccountFor("Rent").value).toBe("41");
  });
});

describe("AI response handling", () => {
  it("parses fenced and bare JSON", () => {
    expect(parseModelJson('```json\n{"vendor":"A"}\n```')).toEqual({ vendor: "A" });
    expect(parseModelJson('```\n{"vendor":"B"}\n```')).toEqual({ vendor: "B" });
    expect(parseModelJson('{"vendor":"C"}')).toEqual({ vendor: "C" });
    expect(() => parseModelJson("[1]")).toThrow();
  });

  it("sniffs file types from magic bytes", () => {
    expect(detectMimeType(new TextEncoder().encode("%PDF-1.7"))).toBe("application/pdf");
    expect(detectMimeType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(detectMimeType(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe("image/png");
    expect(detectMimeType(new Uint8Array([1, 2]))).toBe("image/png");
  });
});

describe("CSV output", () => {
  it("formats money like Python's {:,.2f} and quotes like csv.writer", () => {
    expect(money(1234.5)).toBe("1,234.50");
    expect(money(-0.5)).toBe("-0.50");
    expect(toCsv([["a", "1,234.50", 'say "hi"'], []])).toBe('a,"1,234.50","say ""hi"""\r\n\r\n');
  });
});
