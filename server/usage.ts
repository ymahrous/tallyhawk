import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { PRODUCT_FACTS } from "@/lib/site";
import { getDb } from "./db";
import { usageRecords } from "./db/schema";

/** The same number the pricing page, FAQs and llms.txt advertise. */
export const FREE_TIER_LIMIT = PRODUCT_FACTS.freeDocumentsPerMonth;

/** First day of the current UTC month at midnight — the key of a usage record. */
export function currentMonth(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function documentsProcessedThisMonth(userId: string): Promise<number> {
  const [row] = await getDb()
    .select({ count: usageRecords.documentsProcessed })
    .from(usageRecords)
    .where(and(eq(usageRecords.userId, userId), eq(usageRecords.month, currentMonth())))
    .limit(1);
  return row?.count ?? 0;
}

/** Counts one processed document against this month's quota (atomic upsert). */
export async function incrementUsage(userId: string): Promise<void> {
  await getDb()
    .insert(usageRecords)
    .values({ userId, month: currentMonth(), documentsProcessed: 1 })
    .onConflictDoUpdate({
      target: [usageRecords.userId, usageRecords.month],
      set: { documentsProcessed: sql`${usageRecords.documentsProcessed} + 1` },
    });
}
