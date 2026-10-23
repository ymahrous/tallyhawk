import "server-only";
import { and, eq } from "drizzle-orm";
import { effectiveDate, reliableAmount } from "./amounts";
import type { Db } from "./db";
import { documents, extractions, vendors } from "./db/schema";

export interface SpendRow {
  amount: number | null; // null = not reliably in the user's current base currency; exclude from sums
  date: Date; // invoice date, else upload date
  category: string | null;
  vendorName: string | null;
}

/**
 * Every completed extraction of a user, reduced to what spend reports need. JSON date filtering is
 * done here in JS rather than SQL because the extracted date is free-form text.
 */
export async function loadSpendRows(db: Db, userId: string, baseCurrency: string): Promise<SpendRow[]> {
  const rows = await db
    .select({
      data: extractions.extractedData,
      convertedAmount: extractions.convertedAmount,
      convertedCurrency: extractions.convertedCurrency,
      category: extractions.category,
      vendorName: vendors.canonicalName,
      uploadedAt: documents.createdAt,
    })
    .from(extractions)
    .innerJoin(documents, eq(extractions.documentId, documents.id))
    .leftJoin(vendors, eq(vendors.id, extractions.vendorId))
    .where(and(eq(documents.ownerId, userId), eq(documents.status, "COMPLETED")));

  return rows.map((r) => ({
    amount: reliableAmount(r, baseCurrency),
    date: effectiveDate(r.data, r.uploadedAt),
    category: r.category,
    vendorName: r.vendorName,
  }));
}

export function inPeriod(row: SpendRow, year: number, month?: number): boolean {
  return row.date.getUTCFullYear() === year && (month === undefined || row.date.getUTCMonth() + 1 === month);
}

/** Sums reliable amounts by key, rounding each total to cents. */
export function sumBy(rows: SpendRow[], key: (row: SpendRow) => string): Map<string, number> {
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (row.amount === null) continue; // never blend amounts that aren't in the base currency
    const k = key(row);
    totals.set(k, (totals.get(k) ?? 0) + row.amount);
  }
  for (const [k, v] of totals) totals.set(k, Math.round(v * 100) / 100);
  return totals;
}
