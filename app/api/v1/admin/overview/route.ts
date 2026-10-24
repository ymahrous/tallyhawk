import { and, avg, count, eq, gte, inArray, isNotNull, notInArray, type SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { getDb } from "@/server/db";
import { contactMessages, documents, extractions, feedback, quickbooksConnections, subscriptions, users, vendors } from "@/server/db/schema";
import { getCurrentAdmin, json, route } from "@/server/http";
import { PRODUCT_FACTS } from "@/lib/site";
import type { TriageStatus } from "@/lib/support";

const DAY_MS = 24 * 60 * 60 * 1000;
const OPEN: TriageStatus[] = ["new", "in_progress"];

/** Headline numbers for the admin dashboard. Customers and admins are counted separately. */
export const GET = route(async (request) => {
  await getCurrentAdmin(request);
  const db = getDb();
  const pricePerSeat = Number(process.env.PRO_MONTHLY_PRICE_USD || PRODUCT_FACTS.proPriceUsd);

  const countOf = async (table: PgTable, where?: SQL) => {
    const [row] = await db.select({ n: count() }).from(table).where(where);
    return row.n;
  };

  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const weekStart = new Date(now.getTime() - 7 * DAY_MS);
  const monthStart = new Date(now.getTime() - 30 * DAY_MS);
  const customer = eq(users.role, "user");

  const [totalUsers, proUsers, suspended, admins, signupsToday, signupsWeek, signupsMonth, activeWeek] = await Promise.all([
    countOf(users, customer),
    countOf(users, and(customer, eq(users.plan, "pro"))),
    countOf(users, and(customer, eq(users.status, "suspended"))),
    countOf(users, eq(users.role, "admin")),
    countOf(users, and(customer, gte(users.createdAt, todayStart))),
    countOf(users, and(customer, gte(users.createdAt, weekStart))),
    countOf(users, and(customer, gte(users.createdAt, monthStart))),
    countOf(users, and(customer, gte(users.lastLoginAt, weekStart))),
  ]);

  const [totalDocuments, docsToday, docsWeek, flagged, totalVendors, qbConnections] = await Promise.all([
    countOf(documents),
    countOf(documents, gte(documents.createdAt, todayStart)),
    countOf(documents, gte(documents.createdAt, weekStart)),
    countOf(documents, isNotNull(documents.flags)),
    countOf(vendors),
    countOf(quickbooksConnections),
  ]);

  const [activeSubs, pastDue, canceling, paying] = await Promise.all([
    countOf(subscriptions, eq(subscriptions.status, "active")),
    countOf(subscriptions, eq(subscriptions.status, "past_due")),
    countOf(subscriptions, and(eq(subscriptions.status, "active"), eq(subscriptions.cancelAtPeriodEnd, true))),
    db
      .select({ userId: subscriptions.userId })
      .from(subscriptions)
      .where(inArray(subscriptions.status, ["active", "trialing", "past_due"])),
  ]);
  // Pro without a subscription that's paying for it: granted by an admin.
  const payingIds = paying.map((p) => p.userId);
  const comped = await countOf(users, and(customer, eq(users.plan, "pro"), payingIds.length ? notInArray(users.id, payingIds) : undefined));

  const [totalFeedback, newFeedback, openBugs, totalContact, newContact] = await Promise.all([
    countOf(feedback),
    countOf(feedback, eq(feedback.status, "new")),
    countOf(feedback, and(eq(feedback.type, "Bug"), inArray(feedback.status, OPEN))),
    countOf(contactMessages),
    countOf(contactMessages, eq(contactMessages.status, "new")),
  ]);

  const byStatus = await db.select({ status: documents.status, n: count() }).from(documents).groupBy(documents.status);
  const [{ avgConfidence }] = await db.select({ avgConfidence: avg(extractions.confidenceScore) }).from(extractions);

  return json({
    users: {
      total: totalUsers,
      pro: proUsers,
      free: totalUsers - proUsers,
      suspended,
      active_last_7d: activeWeek,
      signups_today: signupsToday,
      signups_last_7d: signupsWeek,
      signups_last_30d: signupsMonth,
    },
    admins: { total: admins },
    documents: {
      total: totalDocuments,
      by_status: Object.fromEntries(byStatus.map((r) => [r.status, r.n])),
      created_today: docsToday,
      created_last_7d: docsWeek,
      flagged,
      avg_confidence: avgConfidence ? Math.round(Number(avgConfidence) * 1000) / 1000 : null,
    },
    billing: {
      active_subscriptions: activeSubs,
      past_due: pastDue,
      canceling_at_period_end: canceling,
      comped_pro: comped,
      estimated_mrr_usd: Math.round(activeSubs * pricePerSeat * 100) / 100,
      price_per_seat_usd: pricePerSeat,
    },
    integrations: { quickbooks_connections: qbConnections },
    vendors: { total: totalVendors },
    feedback: { total: totalFeedback, new: newFeedback, open_bugs: openBugs },
    contact: { total: totalContact, new: newContact },
  });
});
