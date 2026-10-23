import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { quickbooksConnections } from "@/server/db/schema";
import { getCurrentUser, json, route, type Params } from "@/server/http";
import { qbFetch } from "@/server/quickbooks";

/** Asks QuickBooks whether a Purchase tagged with this document's id exists. */
export const GET = route<Params<"documentId">>(async (request, ctx) => {
  const user = await getCurrentUser(request);
  if (user.plan !== "pro") return json({ synced: false });
  const { documentId } = await ctx.params;
  const db = getDb();

  const [conn] = await db.select().from(quickbooksConnections).where(eq(quickbooksConnections.userId, user.id)).limit(1);
  if (!conn) return json({ synced: false });

  const note = `edocAI-${documentId.replace(/'/g, "")}`;
  const query = encodeURIComponent(`select * from Purchase where PrivateNote = '${note}'`);
  const res = await qbFetch(db, conn, `/v3/company/${conn.realmId}/query?query=${query}`);
  if (res.status !== 200) return json({ synced: false });

  const data = (await res.json()) as { QueryResponse?: { Purchase?: unknown[] } };
  return json({ synced: (data.QueryResponse?.Purchase?.length ?? 0) > 0 });
});
