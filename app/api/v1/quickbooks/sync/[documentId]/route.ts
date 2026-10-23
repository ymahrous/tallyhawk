import { and, eq } from "drizzle-orm";
import { parseAmountOr } from "@/server/amounts";
import { getDb } from "@/server/db";
import { documents, extractions, quickbooksConnections } from "@/server/db/schema";
import { ApiError, getCurrentUser, json, requirePro, route, type Params } from "@/server/http";
import { qbAccountFor, qbFetch, toQbDate } from "@/server/quickbooks";

/** Creates a QuickBooks Purchase (expense) for a processed document. */
export const POST = route<Params<"documentId">>(async (request, ctx) => {
  const user = await getCurrentUser(request);
  requirePro(user, "QuickBooks sync is a Pro feature. Please upgrade.");
  const { documentId } = await ctx.params;
  const db = getDb();

  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.ownerId, user.id)))
    .limit(1);
  if (!doc) throw new ApiError(404, "Document not found.");

  const [extraction] = await db.select().from(extractions).where(eq(extractions.documentId, documentId)).limit(1);
  if (!extraction) throw new ApiError(404, "Extraction not ready.");

  const [conn] = await db.select().from(quickbooksConnections).where(eq(quickbooksConnections.userId, user.id)).limit(1);
  if (!conn) throw new ApiError(400, "QuickBooks not connected. Please connect in settings.");

  const data = extraction.extractedData ?? {};

  // Use the base-currency amount when it's genuinely in the current base currency; otherwise fall
  // back to the raw extracted amount, labelled with its own currency rather than mislabelled.
  const reliable = extraction.convertedAmount !== null && extraction.convertedCurrency === user.baseCurrency;
  const total = reliable ? extraction.convertedAmount! : parseAmountOr(data.total_amount);
  const currency = reliable ? extraction.convertedCurrency! : extraction.originalCurrency || user.baseCurrency;

  const paymentType = /mastercard|visa|credit card|amex/.test(JSON.stringify(data).toLowerCase()) ? "CreditCard" : "Cash";
  const txnDate = toQbDate(String(data.date ?? ""));

  const payload: Record<string, unknown> = {
    PaymentType: paymentType,
    CurrencyRef: { value: currency },
    AccountRef: { value: "41", name: "Opening Balance Equity" }, // the funding account
    TotalAmt: total,
    PrivateNote: `edocAI-${documentId}`, // used by sync-status to find it again
    Line: [
      {
        Id: "1",
        Amount: total,
        DetailType: "AccountBasedExpenseLineDetail",
        AccountBasedExpenseLineDetail: { AccountRef: qbAccountFor(String(data.category ?? "")) },
      },
    ],
    ...(txnDate ? { TxnDate: txnDate } : {}),
  };

  const res = await qbFetch(db, conn, `/v3/company/${conn.realmId}/purchase?minorversion=65`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (res.status !== 200 && res.status !== 201) {
    const body = (await res.json().catch(() => ({}))) as { Fault?: { Error?: { Message?: string }[] } };
    throw new ApiError(500, `QuickBooks Error: ${body.Fault?.Error?.[0]?.Message ?? "Unknown QB Error"}`);
  }

  await db.update(documents).set({ quickbooksSynced: true }).where(eq(documents.id, documentId));
  return json({ message: "Synced to QuickBooks successfully!" });
});
