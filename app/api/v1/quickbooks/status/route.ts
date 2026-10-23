import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { quickbooksConnections } from "@/server/db/schema";
import { getCurrentUser, json, route } from "@/server/http";

export const GET = route(async (request) => {
  const user = await getCurrentUser(request);
  const [conn] = await getDb()
    .select({ id: quickbooksConnections.id })
    .from(quickbooksConnections)
    .where(eq(quickbooksConnections.userId, user.id))
    .limit(1);
  return json({ connected: Boolean(conn) });
});
