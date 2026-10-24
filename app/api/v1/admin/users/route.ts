import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import { enumQuery, pageOf, paged, searchFilter } from "@/server/admin";
import { getDb } from "@/server/db";
import { subscriptions, users } from "@/server/db/schema";
import { getCurrentAdmin, json, route } from "@/server/http";

const SORTS = ["created_at", "last_login_at", "username", "documents"] as const;

/** Customers (never admins), with document counts and subscription status. Searchable and filterable. */
export const GET = route(async (request) => {
  await getCurrentAdmin(request);
  const url = new URL(request.url);
  const page = pageOf(url);
  const plan = enumQuery(url, "plan", ["free", "pro"] as const);
  const status = enumQuery(url, "status", ["active", "suspended"] as const);
  const sort = enumQuery(url, "sort", SORTS) ?? "created_at";
  const order = enumQuery(url, "order", ["asc", "desc"] as const) ?? (sort === "username" ? "asc" : "desc");
  const db = getDb();

  const filter = and(
    eq(users.role, "user"),
    plan ? eq(users.plan, plan) : undefined,
    status ? eq(users.status, status) : undefined,
    searchFilter(url, [users.username])
  );
  const documentCount = sql<number>`(select count(*) from document d where d.owner_id = ${users.id})`.mapWith(Number);
  const sortColumn = { created_at: users.createdAt, last_login_at: users.lastLoginAt, username: users.username, documents: documentCount }[sort];
  const direction = order === "asc" ? asc : desc;

  const rows = await db
    .select({ user: users, documentCount, subscriptionStatus: subscriptions.status, cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd })
    .from(users)
    .leftJoin(subscriptions, eq(subscriptions.userId, users.id))
    .where(filter)
    .orderBy(
      // Never-logged-in customers sort last either way.
      sort === "last_login_at"
        ? order === "asc"
          ? sql`${users.lastLoginAt} asc nulls last`
          : sql`${users.lastLoginAt} desc nulls last`
        : direction(sortColumn),
      asc(users.id)
    )
    .limit(page.limit)
    .offset(page.offset);

  // Same filter as the page, so `total` is what the caller pages through.
  const [{ total }] = await db.select({ total: count() }).from(users).where(filter);

  return json(
    paged(
      total,
      page,
      rows.map((r) => ({
        id: r.user.id,
        username: r.user.username,
        plan: r.user.plan,
        status: r.user.status,
        created_at: r.user.createdAt.toISOString(),
        last_login_at: r.user.lastLoginAt?.toISOString() ?? null,
        document_count: r.documentCount,
        subscription_status: r.subscriptionStatus ?? null,
        cancel_at_period_end: r.cancelAtPeriodEnd ?? false,
      }))
    )
  );
});
