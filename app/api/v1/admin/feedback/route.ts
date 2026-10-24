import { and, count, desc, eq } from "drizzle-orm";
import { enumQuery, pageOf, paged, searchFilter } from "@/server/admin";
import { getDb } from "@/server/db";
import { feedback, users } from "@/server/db/schema";
import { getCurrentAdmin, json, route } from "@/server/http";
import { serializeFeedback } from "@/server/serializers";
import { FEEDBACK_TYPES, TRIAGE_STATUSES } from "@/lib/support";

/** Feedback and bug reports (`type=Bug`), newest first, with the author when they were signed in. */
export const GET = route(async (request) => {
  await getCurrentAdmin(request);
  const url = new URL(request.url);
  const page = pageOf(url);
  const type = enumQuery(url, "type", FEEDBACK_TYPES);
  const status = enumQuery(url, "status", TRIAGE_STATUSES);
  const db = getDb();

  const base = and(type ? eq(feedback.type, type) : undefined, searchFilter(url, [feedback.message]));
  const filter = and(base, status ? eq(feedback.status, status) : undefined);
  const [{ total }] = await db.select({ total: count() }).from(feedback).where(filter);
  const rows = await db
    .select({ feedback, username: users.username })
    .from(feedback)
    .leftJoin(users, eq(users.id, feedback.userId))
    .where(filter)
    .orderBy(desc(feedback.createdAt))
    .limit(page.limit)
    .offset(page.offset);
  // Per-status counts under the other filters, for the inbox tabs.
  const counts = await db.select({ status: feedback.status, n: count() }).from(feedback).where(base).groupBy(feedback.status);

  return json({
    ...paged(total, page, rows.map((r) => serializeFeedback(r.feedback, r.username))),
    status_counts: Object.fromEntries(counts.map((c) => [c.status, c.n])),
  });
});
