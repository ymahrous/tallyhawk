import "server-only";
import { and, eq, isNotNull } from "drizzle-orm";
import { effectiveDate, parseAmountOr, reliableAmount } from "./amounts";
import type { Db } from "./db";
import { documents, extractions } from "./db/schema";

/**
 * Neutralises spreadsheet formulas. Vendor names come from AI extraction of uploaded documents, so a
 * receipt printed with "=HYPERLINK(...)" must not become a live formula in the accountant's Excel.
 * Plain numbers (including negative amounts) are left alone.
 */
export function escapeFormula(value: string): string {
  if (!/^[=+\-@\t\r]/.test(value) || /^-?[\d,]+(\.\d+)?$/.test(value)) return value;
  return `'${value}`;
}

/** Python's csv.writer: quote fields containing a delimiter, quote or newline; CRLF rows. */
export function toCsv(rows: (string | number)[][]): string {
  const cell = (v: string | number) => {
    const s = typeof v === "number" ? String(v) : escapeFormula(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

/** Python's f"{x:,.2f}". */
export function money(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface DetailRow {
  date: string;
  vendor: string;
  category: string;
  originalAmount: number;
  originalCurrency: string;
  convertedAmount: number | null;
  exchangeRate: number | null;
}

/**
 * Builds the yearly tax-summary CSV: one row per categorised, completed document (each with its own
 * original currency), then totals per category in the user's base currency. A document belongs to
 * the year of its invoice date, else its upload date — the same rule as analytics and the dashboard.
 * Rows without a conversion into the current base currency (legacy, no rate available yet, or stale
 * after a currency change) are listed separately and excluded from the totals, never mislabelled.
 */
export async function buildTaxSummaryCsv(db: Db, user: { id: string; baseCurrency: string }, year: number): Promise<string> {
  const base = user.baseCurrency;
  const rows = await db
    .select({ ext: extractions, uploadedAt: documents.createdAt })
    .from(documents)
    .innerJoin(extractions, eq(documents.id, extractions.documentId))
    .where(and(eq(documents.ownerId, user.id), eq(documents.status, "COMPLETED"), isNotNull(extractions.category)));

  const summary = new Map<string, number>();
  const details: DetailRow[] = [];
  const needsReconversion: DetailRow[] = [];

  for (const { ext, uploadedAt } of rows) {
    const data = ext.extractedData ?? {};
    const date = effectiveDate(data, uploadedAt);
    if (date.getUTCFullYear() !== year) continue;

    const convertedAmount = reliableAmount(ext, base);
    const row: DetailRow = {
      date: date.toISOString().slice(0, 10),
      vendor: String(data.vendor ?? ""),
      category: ext.category!,
      originalAmount: ext.originalAmount ?? parseAmountOr(data.total_amount),
      originalCurrency: ext.originalCurrency || base,
      // No valid base-currency figure for these rows: never fabricate one from the raw total, and
      // don't print a rate that converts into some other currency.
      convertedAmount,
      exchangeRate: convertedAmount !== null ? ext.exchangeRate : null,
    };

    if (row.convertedAmount === null) needsReconversion.push(row);
    else summary.set(row.category, Math.round(((summary.get(row.category) ?? 0) + row.convertedAmount) * 100) / 100);
    details.push(row);
  }

  const byDate = (a: DetailRow, b: DetailRow) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  const out: (string | number)[][] = [
    ["Date", "Vendor", "Category", "Original Amount", "Original Currency", `Converted Amount (${base})`, "Exchange Rate"],
  ];
  for (const r of details.sort(byDate)) {
    out.push([
      r.date,
      r.vendor,
      r.category,
      money(r.originalAmount),
      r.originalCurrency,
      r.convertedAmount !== null ? money(r.convertedAmount) : "N/A",
      r.exchangeRate ? r.exchangeRate.toFixed(6) : "N/A",
    ]);
  }

  out.push([], ["SUMMARY BY CATEGORY"], ["Category", `Total (${base})`]);
  for (const [cat, total] of [...summary].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) out.push([cat, money(total)]);

  if (needsReconversion.length) {
    out.push(
      [],
      [`NOTE: ${needsReconversion.length} document(s) excluded from the summary above`],
      [`because they have no up-to-date conversion into ${base} yet (no exchange rate was available, or your base currency changed after they were processed).`],
      ["Date", "Vendor", "Original Amount", "Original Currency"]
    );
    for (const r of needsReconversion.sort(byDate)) out.push([r.date, r.vendor, money(r.originalAmount), r.originalCurrency]);
  }

  return toCsv(out);
}
