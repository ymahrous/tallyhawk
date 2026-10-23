import "server-only";
import type { ExtractedData, ExtractionRow } from "./db/schema";

/**
 * Parses an extracted total like "$1,250.00" or "-€12.5" into a number by stripping everything but
 * digits, dots and minus signs. Empty → 0. Throws on leftovers that aren't a number ("1.2.3").
 */
export function parseAmount(raw: unknown): number {
  if (typeof raw === "number") return raw;
  const cleaned = String(raw ?? "0").replace(/[^\d.-]/g, "");
  if (!cleaned) return 0;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || !/^-?(\d+\.?\d*|\.\d+)$/.test(cleaned)) {
    throw new Error(`Could not parse amount: ${String(raw)}`);
  }
  return value;
}

/** Like parseAmount, but returns `fallback` instead of throwing. */
export function parseAmountOr(raw: unknown, fallback = 0): number {
  try {
    return parseAmount(raw);
  } catch {
    return fallback;
  }
}

/**
 * The row's amount in `baseCurrency`, or null when it can't be reliably compared or summed with
 * other base-currency amounts: only trusts convertedAmount when it was converted into the caller's
 * CURRENT base currency. Anything else (legacy, unconverted, or stale after a base-currency change)
 * must be excluded from aggregates rather than blended in.
 */
export function reliableAmount(
  ext: Pick<ExtractionRow, "convertedAmount" | "convertedCurrency">,
  baseCurrency: string
): number | null {
  if (ext.convertedAmount !== null && ext.convertedCurrency === baseCurrency) return ext.convertedAmount;
  return null;
}

const DATE_FORMATS: { re: RegExp; order: ("y" | "m" | "d")[] }[] = [
  { re: /^(\d{4})-(\d{1,2})-(\d{1,2})$/, order: ["y", "m", "d"] },
  { re: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, order: ["m", "d", "y"] },
  { re: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, order: ["d", "m", "y"] },
  { re: /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/, order: ["y", "m", "d"] },
];

/**
 * Parses the invoice date the AI extracted (YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY or YYYY/MM/DD, any
 * time part ignored) as a UTC midnight Date, or null if it's missing or unparseable.
 */
export function parseInvoiceDate(data: ExtractedData | null): Date | null {
  const raw = data?.date;
  if (!raw || typeof raw !== "string") return null;
  const clean = raw.split("T")[0].split(" ")[0];

  for (const { re, order } of DATE_FORMATS) {
    const match = re.exec(clean);
    if (!match) continue;
    const parts = { y: 0, m: 0, d: 0 };
    order.forEach((key, i) => (parts[key] = Number(match[i + 1])));
    const date = new Date(Date.UTC(parts.y, parts.m - 1, parts.d));
    if (date.getUTCFullYear() === parts.y && date.getUTCMonth() === parts.m - 1 && date.getUTCDate() === parts.d) {
      return date;
    }
  }
  return null;
}

/** Invoice date when the AI found one, otherwise when the document was uploaded. */
export function effectiveDate(data: ExtractedData | null, uploadedAt: Date): Date {
  return parseInvoiceDate(data) ?? uploadedAt;
}
