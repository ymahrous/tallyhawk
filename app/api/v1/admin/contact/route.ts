import { and, count, desc, eq } from "drizzle-orm";
import { enumQuery, pageOf, paged, searchFilter } from "@/server/admin";
import { getDb } from "@/server/db";
import { contactMessages } from "@/server/db/schema";
import { getCurrentAdmin, json, route } from "@/server/http";
import { serializeContactMessage } from "@/server/serializers";
import { TRIAGE_STATUSES } from "@/lib/support";

/** Contact-form submissions, newest first. */
export const GET = route(async (request) => {
  await getCurrentAdmin(request);
  const url = new URL(request.url);
  const page = pageOf(url);
  const status = enumQuery(url, "status", TRIAGE_STATUSES);
  const db = getDb();

  const base = searchFilter(url, [contactMessages.name, contactMessages.email, contactMessages.subject, contactMessages.message]);
  const filter = and(base, status ? eq(contactMessages.status, status) : undefined);
  const [{ total }] = await db.select({ total: count() }).from(contactMessages).where(filter);
  const rows = await db.select().from(contactMessages).where(filter).orderBy(desc(contactMessages.createdAt)).limit(page.limit).offset(page.offset);
  const counts = await db.select({ status: contactMessages.status, n: count() }).from(contactMessages).where(base).groupBy(contactMessages.status);

  return json({
    ...paged(total, page, rows.map(serializeContactMessage)),
    status_counts: Object.fromEntries(counts.map((c) => [c.status, c.n])),
  });
});
