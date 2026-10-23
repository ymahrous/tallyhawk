import { avg, count, eq, gte, isNotNull, type SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { getDb } from "@/server/db";
import { documents, extractions, feedback, quickbooksConnections, subscriptions, users, vendors } from "@/server/db/schema";
import { getCurrentAdmin, json, route } from "@/server/http";

const DAY_MS = 24 * 60 * 60 * 1000;

export const GET = route(async (request) => {
  await getCurrentAdmin(request);
  const db = getDb();
  const pricePerSeat = Number(process.env.PRO_MONTHLY_PRICE_USD ?? "5");

  const countOf = async (table: PgTable, where?: SQL) => {
    const [row] = await db.select({ n: count() }).from(table).where(where);
    return row.n;
  };

  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const weekStart = new Date(now.getTime() - 7 * DAY_MS);
  const monthStart = new Date(now.getTime() - 30 * DAY_MS);

  const [totalUsers, proUsers, signupsToday, signupsWeek, signupsMonth] = await Promise.all([
    countOf(users),
    countOf(users, eq(users.plan, "pro")),
    countOf(users, gte(users.createdAt, todayStart)),
    countOf(users, gte(users.createdAt, weekStart)),
    countOf(users, gte(users.createdAt, monthStart)),
  ]);

  const [totalDocuments, docsToday, docsWeek, flagged, activeSubs, totalVendors, totalFeedback, qbConnections] = await Promise.all([
    countOf(documents),
    countOf(documents, gte(documents.createdAt, todayStart)),
    countOf(documents, gte(documents.createdAt, weekStart)),
    countOf(documents, isNotNull(documents.flags)),
    countOf(subscriptions, eq(subscriptions.status, "active")),
    countOf(vendors),
    countOf(feedback),
    countOf(quickbooksConnections),
  ]);

  const byStatus = await db.select({ status: documents.status, n: count() }).from(documents).groupBy(documents.status);
  const [{ avgConfidence }] = await db.select({ avgConfidence: avg(extractions.confidenceScore) }).from(extractions);

  return json({
    users: {
      total: totalUsers,
      pro: proUsers,
      free: totalUsers - proUsers,
      signups_today: signupsToday,
      signups_last_7d: signupsWeek,
      signups_last_30d: signupsMonth,
    },
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
      estimated_mrr_usd: Math.round(activeSubs * pricePerSeat * 100) / 100,
      price_per_seat_usd: pricePerSeat,
    },
    integrations: { quickbooks_connections: qbConnections },
    vendors: { total: totalVendors },
    feedback: { total: totalFeedback },
  });
});
