import { count, desc, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { documents, users } from "@/server/db/schema";
import { getCurrentAdmin, intQuery, json, route } from "@/server/http";

export const GET = route(async (request) => {
  await getCurrentAdmin(request);
  const url = new URL(request.url);
  const limit = intQuery(url, "limit", { min: 1, max: 200, fallback: 25 })!;
  const offset = intQuery(url, "offset", { min: 0, fallback: 0 })!;
  const plan = url.searchParams.get("plan") || undefined; // 'free' or 'pro'
  const filter = plan ? eq(users.plan, plan) : undefined;
  const db = getDb();

  const rows = await db
    .select({ id: users.id, username: users.username, plan: users.plan, createdAt: users.createdAt, documentCount: count(documents.id) })
    .from(users)
    .leftJoin(documents, eq(documents.ownerId, users.id))
    .where(filter)
    .groupBy(users.id)
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset);

  // Same filter as the page, so `total` is what the caller pages through.
  const [{ total }] = await db.select({ total: count() }).from(users).where(filter);

  return json({
    total,
    limit,
    offset,
    results: rows.map((u) => ({
      id: u.id,
      username: u.username,
      plan: u.plan,
      created_at: u.createdAt.toISOString(),
      document_count: u.documentCount,
    })),
  });
});
