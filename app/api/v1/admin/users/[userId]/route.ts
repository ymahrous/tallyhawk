import { and, count, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { deleteAccount } from "@/server/accounts";
import { findCustomer } from "@/server/admin";
import { audit } from "@/server/audit";
import { subscriptionOf } from "@/server/billing";
import { getDb } from "@/server/db";
import { contactMessages, documents, feedback, quickbooksConnections, users, vendors } from "@/server/db/schema";
import { getCurrentAdmin, json, noContent, parseJson, route, type Params } from "@/server/http";
import { serializeAccount, serializeDocument } from "@/server/serializers";
import { documentsProcessedThisMonth, FREE_TIER_LIMIT } from "@/server/usage";

/** Everything an admin needs to support one customer. */
export const GET = route<Params<"userId">>(async (request, ctx) => {
  await getCurrentAdmin(request);
  const { userId } = await ctx.params;
  const db = getDb();
  const user = await findCustomer(db, userId);

  const countWhere = async (query: Promise<{ n: number }[]>) => (await query)[0].n;
  const [sub, usedThisMonth, byStatus, recent, vendorCount, qb, feedbackCount, contactCount] = await Promise.all([
    subscriptionOf(db, user.id),
    documentsProcessedThisMonth(user.id),
    db.select({ status: documents.status, n: count() }).from(documents).where(eq(documents.ownerId, user.id)).groupBy(documents.status),
    db.select().from(documents).where(eq(documents.ownerId, user.id)).orderBy(desc(documents.createdAt)).limit(10),
    countWhere(db.select({ n: count() }).from(vendors).where(eq(vendors.userId, user.id))),
    countWhere(db.select({ n: count() }).from(quickbooksConnections).where(eq(quickbooksConnections.userId, user.id))),
    countWhere(db.select({ n: count() }).from(feedback).where(eq(feedback.userId, user.id))),
    countWhere(db.select({ n: count() }).from(contactMessages).where(eq(contactMessages.userId, user.id))),
  ]);

  return json({
    ...serializeAccount(user),
    usage: { documents_processed_this_month: usedThisMonth, limit: user.plan === "free" ? FREE_TIER_LIMIT : -1 },
    documents: {
      total: byStatus.reduce((sum, r) => sum + r.n, 0),
      by_status: Object.fromEntries(byStatus.map((r) => [r.status, r.n])),
      recent: recent.map(serializeDocument),
    },
    subscription: sub
      ? {
          status: sub.status,
          current_period_end: sub.currentPeriodEnd?.toISOString() ?? null,
          cancel_at_period_end: sub.cancelAtPeriodEnd,
          stripe_customer_id: sub.stripeCustomerId,
          stripe_subscription_id: sub.stripeSubscriptionId,
        }
      : null,
    vendors: vendorCount,
    quickbooks_connected: qb > 0,
    feedback_count: feedbackCount,
    contact_count: contactCount,
  });
});

const Update = z
  .object({ plan: z.enum(["free", "pro"]).optional(), status: z.enum(["active", "suspended"]).optional() })
  .refine((body) => body.plan !== undefined || body.status !== undefined, "Nothing to update.");

/**
 * Changes a customer's plan (e.g. comp Pro, or revoke it; Stripe billing isn't touched) or suspends
 * or reactivates them. Suspending signs them out everywhere at once.
 */
export const PATCH = route<Params<"userId">>(async (request, ctx) => {
  const admin = await getCurrentAdmin(request);
  const { userId } = await ctx.params;
  const body = await parseJson(request, Update);
  const db = getDb();
  const user = await findCustomer(db, userId);

  const changes: Record<string, { from: string; to: string }> = {};
  if (body.plan && body.plan !== user.plan) changes.plan = { from: user.plan, to: body.plan };
  if (body.status && body.status !== user.status) changes.status = { from: user.status, to: body.status };

  if (Object.keys(changes).length) {
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({
          ...(changes.plan ? { plan: body.plan } : {}),
          ...(changes.status ? { status: body.status } : {}),
          // Suspension revokes sessions immediately; the plan claim in old tokens only seeds the UI.
          ...(changes.status?.to === "suspended" ? { tokenVersion: sql`${users.tokenVersion} + 1` } : {}),
        })
        .where(and(eq(users.id, user.id), eq(users.role, "user")));
      await audit(tx, request, admin, { action: "user.update", targetType: "user", targetId: user.id, targetLabel: user.username, details: changes });
    });
  }

  return json(serializeAccount(await findCustomer(db, user.id)));
});

/**
 * Permanently deletes a customer: cancels their subscription and removes their files and data,
 * keeping only the deletion record (GET /admin/deleted-accounts).
 */
export const DELETE = route<Params<"userId">>(async (request, ctx) => {
  const admin = await getCurrentAdmin(request);
  const { userId } = await ctx.params;
  const db = getDb();
  const user = await findCustomer(db, userId);
  await deleteAccount(db, user, { by: "admin", admin });
  await audit(db, request, admin, { action: "user.delete", targetType: "user", targetId: user.id, targetLabel: user.username });
  return noContent();
});
