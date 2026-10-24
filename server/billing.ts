import "server-only";
import { desc, eq, or } from "drizzle-orm";
import type Stripe from "stripe";
import type { Db } from "./db";
import { deletedAccounts, subscriptions, users, type SubscriptionRow } from "./db/schema";
import { stripe } from "./stripe";

// The one place Stripe state becomes Tallyhawk state. The webhook, the post-checkout confirmation
// and the admin tools all go through syncSubscription(), which always applies the subscription as
// Stripe reports it *now* — so retried, replayed or out-of-order events can't regress anything.

/**
 * Statuses that keep Pro. `past_due` is included: Stripe is still retrying the card, and cutting
 * access during that grace period would punish an expired card harder than Stripe's own dunning.
 */
const PRO_STATUSES = new Set<string>(["active", "trialing", "past_due"]);

/** Subscription statuses that can still bill the customer (and must be cancelled before deleting them). */
const BILLABLE_STATUSES = new Set<string>(["active", "trialing", "past_due", "unpaid", "incomplete", "paused"]);

export function planForStatus(status: string): "pro" | "free" {
  return PRO_STATUSES.has(status) ? "pro" : "free";
}

export function idOf(value: string | { id: string } | null | undefined): string | null {
  return typeof value === "string" ? value : (value?.id ?? null);
}

const fromUnix = (seconds: number | null | undefined) => (seconds ? new Date(seconds * 1000) : null);

/** Fetches the latest state of a subscription from Stripe. */
export function retrieveSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
  return stripe().subscriptions.retrieve(subscriptionId);
}

/**
 * Writes `sub` to the subscription row of its owner and sets their plan. The owner is the user the
 * caller vouches for (`userId`, from a checkout session we created), else the `user_id` metadata we
 * put on every subscription, else whoever already holds this subscription or customer. Returns the
 * owner's id, or null when the subscription belongs to no live account: if it belonged to a deleted
 * one, that account's deletion record is updated instead (see syncDeletedAccountSubscription).
 */
export async function syncSubscription(db: Db, sub: Stripe.Subscription, userId?: string | null): Promise<string | null> {
  const customerId = idOf(sub.customer);
  let ownerId = userId || sub.metadata?.user_id || null;
  if (!ownerId) {
    const [existing] = await db
      .select({ userId: subscriptions.userId })
      .from(subscriptions)
      .where(or(eq(subscriptions.stripeSubscriptionId, sub.id), customerId ? eq(subscriptions.stripeCustomerId, customerId) : undefined))
      .limit(1);
    ownerId = existing?.userId ?? null;
  }
  // No live customer owns it: a deleted account's subscription, or one we've never seen.
  const [owner] = ownerId ? await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.id, ownerId)).limit(1) : [];
  if (!owner || owner.role !== "user") {
    await syncDeletedAccountSubscription(db, sub, ownerId);
    return null;
  }

  const plan = planForStatus(sub.status);
  const item = sub.items?.data?.[0];
  const values = {
    plan,
    status: sub.status,
    stripeCustomerId: customerId,
    stripeSubscriptionId: sub.id,
    currentPeriodStart: fromUnix(item?.current_period_start),
    currentPeriodEnd: fromUnix(item?.current_period_end),
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end || sub.cancel_at),
    updatedAt: new Date(),
  };

  await db.transaction(async (tx) => {
    // A newer subscription replaces an ended one; an ended one never replaces a live one.
    const [current] = await tx.select().from(subscriptions).where(eq(subscriptions.userId, owner.id)).limit(1);
    const replacesLive = Boolean(current?.stripeSubscriptionId && current.stripeSubscriptionId !== sub.id && PRO_STATUSES.has(current.status));
    if (replacesLive && plan === "free") return;
    if (replacesLive) {
      // Two live subscriptions (e.g. checkout completed in two tabs): Stripe bills both, but only
      // the newer is tracked here. Flag it so an admin can cancel the older one in Stripe.
      console.warn(JSON.stringify({ level: "warn", event: "duplicate_subscription", userId: owner.id, kept: sub.id, replaced: current!.stripeSubscriptionId }));
    }
    await tx
      .insert(subscriptions)
      .values({ userId: owner.id, ...values })
      .onConflictDoUpdate({ target: subscriptions.userId, set: values });
    await tx.update(users).set({ plan }).where(eq(users.id, owner.id));
  });
  return owner.id;
}

/** The user's subscription row, if they ever started checkout successfully. */
export async function subscriptionOf(db: Db, userId: string): Promise<SubscriptionRow | undefined> {
  const [row] = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).limit(1);
  return row;
}

/**
 * Cancels a Stripe subscription immediately. "missing" means Stripe no longer has it (e.g. it was
 * already cancelled from the Stripe dashboard), which is fine; any other failure throws.
 */
async function cancelStripeSubscription(subscriptionId: string): Promise<"cancelled" | "missing"> {
  try {
    await stripe().subscriptions.cancel(subscriptionId);
    return "cancelled";
  } catch (error) {
    if ((error as { code?: string } | null)?.code === "resource_missing") return "missing";
    throw error;
  }
}

/**
 * Cancels the subscription in `row` if it could still bill the customer. Called before an account is
 * deleted: otherwise Stripe would keep charging someone whose account no longer exists.
 */
export async function cancelBillableSubscription(row: SubscriptionRow | undefined): Promise<"cancelled" | "missing" | "not_billable"> {
  if (!row?.stripeSubscriptionId || !BILLABLE_STATUSES.has(row.status)) return "not_billable";
  return cancelStripeSubscription(row.stripeSubscriptionId);
}

/**
 * Keeps a deleted account's record in step with Stripe. Matches it by the former user id (from the
 * hint or subscription metadata), the subscription or the customer. A subscription that could still
 * bill (e.g. a checkout the person finished after deleting their account) is cancelled on the spot
 * and logged for an admin to review. Returns whether a deletion record matched.
 */
export async function syncDeletedAccountSubscription(db: Db, sub: Stripe.Subscription, formerUserId?: string | null): Promise<boolean> {
  const customerId = idOf(sub.customer);
  const [record] = await db
    .select()
    .from(deletedAccounts)
    .where(
      or(
        formerUserId ? eq(deletedAccounts.userId, formerUserId) : undefined,
        eq(deletedAccounts.stripeSubscriptionId, sub.id),
        customerId ? eq(deletedAccounts.stripeCustomerId, customerId) : undefined
      )
    )
    .orderBy(desc(deletedAccounts.deletedAt))
    .limit(1);
  if (!record) return false;

  let status = sub.status;
  let billingCancelledAt = record.billingCancelledAt;
  if (BILLABLE_STATUSES.has(sub.status)) {
    await cancelStripeSubscription(sub.id);
    status = "canceled";
    billingCancelledAt = new Date();
    console.warn(JSON.stringify({ level: "warn", event: "billing_after_deletion_cancelled", deletedUserId: record.userId, subscription: sub.id }));
  }

  // The record follows the subscription it already names; one that turns up later (a stray checkout)
  // is adopted only if it named none. Either way, billing it stopped is recorded.
  const tracksThis = !record.stripeSubscriptionId || record.stripeSubscriptionId === sub.id;
  await db
    .update(deletedAccounts)
    .set({
      ...(tracksThis
        ? {
            stripeSubscriptionId: sub.id,
            stripeCustomerId: record.stripeCustomerId ?? customerId,
            subscriptionStatus: status,
            currentPeriodEnd: fromUnix(sub.items?.data?.[0]?.current_period_end) ?? record.currentPeriodEnd,
          }
        : {}),
      billingCancelledAt,
      updatedAt: new Date(),
    })
    .where(eq(deletedAccounts.id, record.id));
  return true;
}
