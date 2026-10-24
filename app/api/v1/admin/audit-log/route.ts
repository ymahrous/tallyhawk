import { and, count, desc, eq, like } from "drizzle-orm";
import { pageOf, paged, searchFilter } from "@/server/admin";
import { getDb } from "@/server/db";
import { auditLog } from "@/server/db/schema";
import { getCurrentAdmin, json, route } from "@/server/http";
import { serializeAuditEntry } from "@/server/serializers";

const AREAS = ["user", "admin", "feedback", "contact", "document"];

/** Every admin write, newest first. `area` filters by the kind of target (e.g. `user`). */
export const GET = route(async (request) => {
  await getCurrentAdmin(request);
  const url = new URL(request.url);
  const page = pageOf(url);
  const area = url.searchParams.get("area");
  const db = getDb();

  const filter = and(
    area && AREAS.includes(area) ? like(auditLog.action, `${area}.%`) : undefined,
    url.searchParams.get("actor") ? eq(auditLog.actorId, url.searchParams.get("actor")!) : undefined,
    searchFilter(url, [auditLog.actorUsername, auditLog.targetLabel, auditLog.action])
  );
  const [{ total }] = await db.select({ total: count() }).from(auditLog).where(filter);
  const rows = await db.select().from(auditLog).where(filter).orderBy(desc(auditLog.createdAt)).limit(page.limit).offset(page.offset);
  return json(paged(total, page, rows.map(serializeAuditEntry)));
});
