import { and, count, desc, eq, gte, isNotNull, lt, sql, type SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { dayRange } from "@/server/admin";
import { getDb } from "@/server/db";
import { contactMessages, documents, extractions, feedback, users } from "@/server/db/schema";
import { getCurrentAdmin, intQuery, json, route } from "@/server/http";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Product analytics for the admin dashboard over the last `days` (7–365, default 30): a daily
 * series of signups, uploads, failures and support volume, plus breakdowns of documents, plans,
 * categories and currencies. Days are UTC calendar days; days with nothing are reported as 0.
 */
export const GET = route(async (request) => {
  await getCurrentAdmin(request);
  const days = intQuery(new URL(request.url), "days", { min: 7, max: 365, fallback: 30 })!;
  const db = getDb();
  const range = dayRange(days);
  const since = new Date(`${range[0]}T00:00:00Z`);

  /** Rows per UTC day in `column` since the start of the range. `user.created_at` is timestamptz. */
  const perDay = async (table: PgTable, column: PgColumn, where?: SQL, withTimezone = false) => {
    const day = withTimezone
      ? sql<string>`to_char((${column} AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD')`
      : sql<string>`to_char(${column}::date, 'YYYY-MM-DD')`;
    const rows = await db.select({ day, n: count() }).from(table).where(and(gte(column, since), where)).groupBy(day);
    return new Map(rows.map((r) => [r.day, r.n]));
  };

  const [signups, uploads, failed, feedbackPerDay, contactPerDay] = await Promise.all([
    perDay(users, users.createdAt, eq(users.role, "user"), true),
    perDay(documents, documents.createdAt),
    perDay(documents, documents.createdAt, eq(documents.status, "FAILED")),
    perDay(feedback, feedback.createdAt),
    perDay(contactMessages, contactMessages.createdAt),
  ]);

  const series = range.map((date) => ({
    date,
    signups: signups.get(date) ?? 0,
    documents: uploads.get(date) ?? 0,
    failed: failed.get(date) ?? 0,
    feedback: feedbackPerDay.get(date) ?? 0,
    contact: contactPerDay.get(date) ?? 0,
  }));

  const inRange = gte(documents.createdAt, since);
  const [plans, statuses, categories, currencies, topUploaders, feedbackTypes] = await Promise.all([
    db.select({ name: users.plan, value: count() }).from(users).where(eq(users.role, "user")).groupBy(users.plan),
    db.select({ name: documents.status, value: count() }).from(documents).where(inRange).groupBy(documents.status),
    db
      .select({ name: extractions.category, value: count() })
      .from(extractions)
      .innerJoin(documents, eq(documents.id, extractions.documentId))
      .where(and(inRange, isNotNull(extractions.category)))
      .groupBy(extractions.category)
      .orderBy(desc(count()))
      .limit(12),
    db
      .select({ name: extractions.originalCurrency, value: count() })
      .from(extractions)
      .innerJoin(documents, eq(documents.id, extractions.documentId))
      .where(and(inRange, isNotNull(extractions.originalCurrency)))
      .groupBy(extractions.originalCurrency)
      .orderBy(desc(count()))
      .limit(10),
    db
      .select({ id: users.id, username: users.username, plan: users.plan, documents: count() })
      .from(documents)
      .innerJoin(users, eq(users.id, documents.ownerId))
      .where(inRange)
      .groupBy(users.id)
      .orderBy(desc(count()))
      .limit(10),
    db.select({ name: feedback.type, value: count() }).from(feedback).where(gte(feedback.createdAt, since)).groupBy(feedback.type),
  ]);

  const totals = series.reduce(
    (acc, d) => ({ signups: acc.signups + d.signups, documents: acc.documents + d.documents, failed: acc.failed + d.failed }),
    { signups: 0, documents: 0, failed: 0 }
  );
  // Same-length window just before this one, for "vs previous period".
  const previousSince = new Date(since.getTime() - days * DAY_MS);
  const [[prevSignups], [prevDocuments]] = await Promise.all([
    db.select({ n: count() }).from(users).where(and(eq(users.role, "user"), gte(users.createdAt, previousSince), lt(users.createdAt, since))),
    db.select({ n: count() }).from(documents).where(and(gte(documents.createdAt, previousSince), lt(documents.createdAt, since))),
  ]);

  return json({
    days,
    series,
    totals: {
      ...totals,
      failure_rate: totals.documents ? Math.round((totals.failed / totals.documents) * 1000) / 1000 : 0,
      previous_signups: prevSignups.n,
      previous_documents: prevDocuments.n,
    },
    plans,
    document_statuses: statuses,
    categories: categories.map((c) => ({ name: c.name ?? "Uncategorised", value: c.value })),
    currencies: currencies.map((c) => ({ name: c.name ?? "Unknown", value: c.value })),
    top_uploaders: topUploaders,
    feedback_types: feedbackTypes,
  });
});
