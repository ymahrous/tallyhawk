import "server-only";
import { and, eq, gte, ne } from "drizzle-orm";
import { reliableAmount } from "./amounts";
import type { Db } from "./db";
import { documents, extractions, type ExtractedData } from "./db/schema";

const DAY_MS = 24 * 60 * 60 * 1000;

function vendorsMatch(a: string, b: string): boolean {
  // Every string contains "", so a document without a vendor would otherwise match all of them.
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}

/**
 * Post-processing flags for a freshly completed extraction:
 * - `possible_duplicate`: same vendor (one name contains the other) and the same base-currency
 *   amount on another completed document uploaded in the last 30 days.
 * - `price_anomaly`: more than 3× this vendor's historical average (needs ≥ 2 past purchases).
 * `currentAmount` is already in `baseCurrency`; rows whose amount isn't (see reliableAmount) are
 * skipped instead of being compared as if they were.
 */
export async function checkForDuplicates(
  db: Db,
  args: { userId: string; documentId: string; data: ExtractedData; currentAmount: number; baseCurrency: string }
): Promise<string[]> {
  const flags: string[] = [];
  const vendor = String(args.data.vendor ?? "").toLowerCase();
  const amount = args.currentAmount;
  if (!vendor || amount === 0) return flags;

  const others = and(eq(documents.ownerId, args.userId), ne(documents.id, args.documentId), eq(documents.status, "COMPLETED"));

  const recent = await db
    .select({ data: extractions.extractedData, convertedAmount: extractions.convertedAmount, convertedCurrency: extractions.convertedCurrency })
    .from(documents)
    .innerJoin(extractions, eq(documents.id, extractions.documentId))
    .where(and(others, gte(documents.createdAt, new Date(Date.now() - 30 * DAY_MS))));

  for (const ext of recent) {
    const extAmount = reliableAmount(ext, args.baseCurrency);
    if (extAmount === null) continue;
    if (vendorsMatch(vendor, String(ext.data?.vendor ?? "").toLowerCase()) && extAmount === amount) {
      flags.push("possible_duplicate");
      break;
    }
  }

  const history = await db
    .select({ data: extractions.extractedData, convertedAmount: extractions.convertedAmount, convertedCurrency: extractions.convertedCurrency })
    .from(extractions)
    .innerJoin(documents, eq(documents.id, extractions.documentId))
    .where(others);

  const vendorAmounts = history
    .filter((ext) => vendorsMatch(vendor, String(ext.data?.vendor ?? "").toLowerCase()))
    .map((ext) => reliableAmount(ext, args.baseCurrency))
    .filter((v): v is number => v !== null);

  if (vendorAmounts.length >= 2) {
    const avg = vendorAmounts.reduce((sum, v) => sum + v, 0) / vendorAmounts.length;
    if (avg > 0 && amount > avg * 3) flags.push("price_anomaly");
  }

  return flags;
}
