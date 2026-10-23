import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { quickbooksConnections } from "@/server/db/schema";
import { ApiError, getCurrentUser, json, route } from "@/server/http";

export const DELETE = route(async (request) => {
  const user = await getCurrentUser(request);
  const deleted = await getDb()
    .delete(quickbooksConnections)
    .where(eq(quickbooksConnections.userId, user.id))
    .returning({ id: quickbooksConnections.id });
  if (!deleted.length) throw new ApiError(404, "QuickBooks is not connected.");
  return json({ message: "QuickBooks disconnected successfully." });
});
