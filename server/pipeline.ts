import "server-only";
import { and, eq, isNotNull } from "drizzle-orm";
import { parseAmount } from "./amounts";
import { runAiExtraction } from "./ai";
import { convertCurrency, round } from "./currency";
import { getDb, type Db } from "./db";
import { documents, extractions, users, type ExtractionRow } from "./db/schema";
import { checkForDuplicates } from "./detection";
import { matchOrCreateVendor } from "./vendors";

// The per-document pipeline that used to run in the Celery worker (tasks.py). It's now scheduled
// with runInBackground() right after an upload responds.

export type ProcessResult = { status: "success" | "failed"; documentId: string; error?: string };

export async function processDocument(documentId: string): Promise<ProcessResult> {
  const db = getDb();
  const [document] = await db.select().from(documents).where(eq(documents.id, documentId));
  if (!document) return { status: "failed", documentId, error: "Document not found" };

  const [owner] = await db.select({ baseCurrency: users.baseCurrency }).from(users).where(eq(users.id, document.ownerId));
  const baseCurrency = owner?.baseCurrency ?? "USD";

  try {
    await db.update(documents).set({ status: "PROCESSING" }).where(eq(documents.id, documentId));

    const ai = await runAiExtraction(document.s3Url);
    const data = ai.data;
    const category = typeof data.category === "string" && data.category ? data.category : "Other";
    const originalCurrency = String(data.currency || "USD").toUpperCase();
    const originalAmount = parseAmount(data.total_amount ?? "0");

    // A null rate means conversion is unavailable right now (no API key / API failure). Leave the
    // converted fields unset, like a legacy row, rather than claiming the raw amount is in the base
    // currency; reconvertUserExtractions() picks the row up on the next currency change/backfill.
    const conversion = await convertCurrency(originalAmount, originalCurrency, baseCurrency);
    const converted =
      conversion.rate !== null
        ? { convertedAmount: round(conversion.amount, 2), convertedCurrency: baseCurrency, exchangeRate: round(conversion.rate, 6) }
        : { convertedAmount: null, convertedCurrency: null, exchangeRate: null };

    const vendor = await matchOrCreateVendor(db, document.ownerId, typeof data.vendor === "string" ? data.vendor : null);

    await db.transaction(async (tx) => {
      await tx.insert(extractions).values({
        documentId,
        extractedData: data,
        confidenceScore: ai.confidence,
        category,
        vendorId: vendor?.id ?? null,
        originalCurrency,
        originalAmount,
        ...converted,
      });
      await tx.update(documents).set({ status: "COMPLETED" }).where(eq(documents.id, documentId));
    });

    if (data.vendor && converted.convertedAmount !== null) {
      const flags = await checkForDuplicates(db, {
        userId: document.ownerId,
        documentId,
        data,
        currentAmount: converted.convertedAmount,
        baseCurrency,
      });
      if (flags.length) await db.update(documents).set({ flags: flags.join(",") }).where(eq(documents.id, documentId));
    }

    console.info(JSON.stringify({ level: "info", event: "document_processed", documentId }));
    return { status: "success", documentId };
  } catch (error) {
    await db.update(documents).set({ status: "FAILED" }).where(eq(documents.id, documentId));
    console.error(JSON.stringify({ level: "error", event: "document_failed", documentId, error: String(error) }));
    return { status: "failed", documentId, error: String(error) };
  }
}

/**
 * Re-converts every completed extraction of this user that has a known original amount/currency
 * into `baseCurrency`, in place, so totals, analytics and exports never mix currencies after the
 * user changes their base currency. One exchange-rate lookup per distinct original currency.
 * Legacy rows without an original amount/currency are left alone. Returns the rows updated.
 */
export async function reconvertUserExtractions(db: Db, userId: string, baseCurrency: string): Promise<number> {
  const rows = await db
    .select({ ext: extractions })
    .from(extractions)
    .innerJoin(documents, eq(extractions.documentId, documents.id))
    .where(
      and(
        eq(documents.ownerId, userId),
        eq(documents.status, "COMPLETED"),
        isNotNull(extractions.originalAmount),
        isNotNull(extractions.originalCurrency)
      )
    );

  const byCurrency = new Map<string, ExtractionRow[]>();
  for (const { ext } of rows) {
    if (ext.convertedCurrency === baseCurrency) continue;
    const list = byCurrency.get(ext.originalCurrency!) ?? [];
    list.push(ext);
    byCurrency.set(ext.originalCurrency!, list);
  }

  let updated = 0;
  for (const [originalCurrency, exts] of byCurrency) {
    const { rate } = await convertCurrency(1, originalCurrency, baseCurrency);
    if (rate === null) {
      // No rate available right now: leave these rows stale (still correctly excluded from totals)
      // instead of writing a fabricated rate. They're retried the next time this runs.
      console.warn(`Skipping reconversion of ${exts.length} row(s) from ${originalCurrency}: no rate available`);
      continue;
    }
    await db.transaction(async (tx) => {
      for (const ext of exts) {
        await tx
          .update(extractions)
          .set({ convertedAmount: round(ext.originalAmount! * rate, 2), convertedCurrency: baseCurrency, exchangeRate: round(rate, 6) })
          .where(eq(extractions.id, ext.id));
      }
    });
    updated += exts.length;
  }
  return updated;
}

/**
 * Fired whenever a user changes base_currency. Re-reads the currency at execution time rather than
 * trusting the caller, so rapid repeated changes converge to whatever it is *now*.
 */
export async function reconvertUserCurrency(userId: string): Promise<number | null> {
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) return null;
  const updated = await reconvertUserExtractions(db, userId, user.baseCurrency);
  console.info(JSON.stringify({ level: "info", event: "currency_reconverted", userId, updated, baseCurrency: user.baseCurrency }));
  return updated;
}
