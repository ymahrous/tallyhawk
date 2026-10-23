import { desc, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { documents } from "@/server/db/schema";
import { getCurrentUser, json, route } from "@/server/http";
import { serializeDocument } from "@/server/serializers";

export const GET = route(async (request) => {
  const user = await getCurrentUser(request);
  const rows = await getDb().select().from(documents).where(eq(documents.ownerId, user.id)).orderBy(desc(documents.createdAt));
  return json(rows.map(serializeDocument));
});
