import { and, eq, sql } from "drizzle-orm";
import { loadSpendRows } from "@/server/analytics";
import { getDb } from "@/server/db";
import { documents, usageRecords } from "@/server/db/schema";
import { getCurrentUser, json, route } from "@/server/http";

export const GET = route(async (request) => {
  const user = await getCurrentUser(request);
  const db = getDb();
  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  // From the usage ledger, so deleting documents doesn't lower the lifetime count.
  const [{ processed }] = await db
    .select({ processed: sql<number>`coalesce(sum(${usageRecords.documentsProcessed}), 0)::int` })
    .from(usageRecords)
    .where(eq(usageRecords.userId, user.id));

  const [{ synced }] = await db
    .select({ synced: sql<number>`count(*)::int` })
    .from(documents)
    .where(and(eq(documents.ownerId, user.id), eq(documents.quickbooksSynced, true)));

  let monthSpend = 0;
  let excluded = 0;
  for (const row of await loadSpendRows(db, user.id, user.baseCurrency)) {
    if (row.date < startOfMonth || row.date > now) continue;
    if (row.amount === null) excluded++;
    else monthSpend += row.amount;
  }

  return json({
    processed,
    synced,
    month_spend: Math.round(monthSpend * 100) / 100,
    excluded_from_month_spend: excluded, // docs skipped: wrong/stale currency data
  });
});
