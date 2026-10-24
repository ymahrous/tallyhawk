import { and, count, desc, eq } from "drizzle-orm";
import { enumQuery, pageOf, paged, searchFilter } from "@/server/admin";
import { getDb } from "@/server/db";
import { deletedAccounts } from "@/server/db/schema";
import { getCurrentAdmin, json, route } from "@/server/http";
import { hadSubscription } from "@/server/retention";
import { serializeDeletedAccount } from "@/server/serializers";

/**
 * Deleted accounts, newest first: who they were, who deleted them, and their Stripe subscription
 * (kept current by the webhook after deletion). Records past the retention period are anonymized:
 * no email, former id or Stripe ids, but still listed. Filter by `deleted_by`, `role` or `subscription=true`
 * (only those that had one); search by email, former id or Stripe id.
 */
export const GET = route(async (request) => {
  await getCurrentAdmin(request);
  const url = new URL(request.url);
  const page = pageOf(url);
  const deletedBy = enumQuery(url, "deleted_by", ["self", "admin"] as const);
  const role = enumQuery(url, "role", ["user", "admin"] as const);
  const db = getDb();

  const filter = and(
    deletedBy ? eq(deletedAccounts.deletedBy, deletedBy) : undefined,
    role ? eq(deletedAccounts.role, role) : undefined,
    url.searchParams.get("subscription") === "true" ? hadSubscription : undefined,
    searchFilter(url, [deletedAccounts.username, deletedAccounts.userId, deletedAccounts.stripeCustomerId, deletedAccounts.stripeSubscriptionId])
  );
  const [{ total }] = await db.select({ total: count() }).from(deletedAccounts).where(filter);
  const rows = await db.select().from(deletedAccounts).where(filter).orderBy(desc(deletedAccounts.deletedAt)).limit(page.limit).offset(page.offset);
  return json(paged(total, page, rows.map(serializeDeletedAccount)));
});
