import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { vendors } from "@/server/db/schema";
import { getCurrentUser, json, route } from "@/server/http";
import { serializeVendor } from "@/server/vendors";

export const GET = route(async (request) => {
  const user = await getCurrentUser(request);
  const rows = await getDb().select().from(vendors).where(eq(vendors.userId, user.id));
  return json(rows.map(serializeVendor));
});
