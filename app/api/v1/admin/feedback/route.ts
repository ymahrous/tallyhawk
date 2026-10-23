import { count, desc, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { feedback, users } from "@/server/db/schema";
import { getCurrentAdmin, intQuery, json, route } from "@/server/http";

export const GET = route(async (request) => {
  await getCurrentAdmin(request);
  const url = new URL(request.url);
  const limit = intQuery(url, "limit", { min: 1, max: 200, fallback: 25 })!;
  const offset = intQuery(url, "offset", { min: 0, fallback: 0 })!;
  const db = getDb();

  const [{ total }] = await db.select({ total: count() }).from(feedback);
  const rows = await db
    .select({ id: feedback.id, type: feedback.type, message: feedback.message, createdAt: feedback.createdAt, username: users.username })
    .from(feedback)
    .leftJoin(users, eq(users.id, feedback.userId))
    .orderBy(desc(feedback.createdAt))
    .limit(limit)
    .offset(offset);

  return json({
    total,
    limit,
    offset,
    results: rows.map((f) => ({ id: f.id, type: f.type, message: f.message, created_at: f.createdAt.toISOString(), username: f.username })),
  });
});
