import { and, count, desc, eq, isNotNull } from "drizzle-orm";
import { enumQuery, pageOf, paged, searchFilter } from "@/server/admin";
import { getDb } from "@/server/db";
import { documents, users } from "@/server/db/schema";
import { getCurrentAdmin, json, route } from "@/server/http";

const STATUSES = ["PENDING", "PROCESSING", "COMPLETED", "FAILED"] as const;

/**
 * Documents across all customers, newest first, for monitoring the pipeline. Metadata only: the
 * file link and extracted contents stay with their owner.
 */
export const GET = route(async (request) => {
  await getCurrentAdmin(request);
  const url = new URL(request.url);
  const page = pageOf(url);
  const status = enumQuery(url, "status", STATUSES);
  const flagged = url.searchParams.get("flagged") === "true";
  const db = getDb();

  const filter = and(
    status ? eq(documents.status, status) : undefined,
    flagged ? isNotNull(documents.flags) : undefined,
    searchFilter(url, [documents.filename, users.username])
  );
  const [{ total }] = await db.select({ total: count() }).from(documents).innerJoin(users, eq(users.id, documents.ownerId)).where(filter);
  const rows = await db
    .select({ doc: documents, username: users.username })
    .from(documents)
    .innerJoin(users, eq(users.id, documents.ownerId))
    .where(filter)
    .orderBy(desc(documents.createdAt))
    .limit(page.limit)
    .offset(page.offset);

  return json(
    paged(
      total,
      page,
      rows.map(({ doc, username }) => ({
        id: doc.id,
        filename: doc.filename,
        status: doc.status,
        flags: doc.flags,
        quickbooks_synced: doc.quickbooksSynced,
        created_at: doc.createdAt.toISOString(),
        owner_id: doc.ownerId,
        owner_username: username,
      }))
    )
  );
});
