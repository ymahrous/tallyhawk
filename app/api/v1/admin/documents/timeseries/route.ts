import { count, gte, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { documents } from "@/server/db/schema";
import { getCurrentAdmin, intQuery, json, route } from "@/server/http";

/** Documents created per day over the last `days` days (1–180, default 30), for charts. */
export const GET = route(async (request) => {
  await getCurrentAdmin(request);
  const days = intQuery(new URL(request.url), "days", { min: 1, max: 180, fallback: 30 })!;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const day = sql<string>`to_char(date(${documents.createdAt}), 'YYYY-MM-DD')`;
  const rows = await getDb()
    .select({ date: day, count: count() })
    .from(documents)
    .where(gte(documents.createdAt, since))
    .groupBy(day)
    .orderBy(day);

  return json(rows);
});
