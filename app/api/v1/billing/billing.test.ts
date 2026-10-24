// @vitest-environment node
import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { decodeAccessToken } from "@/server/auth";
import type { Db } from "@/server/db";
import { deletedAccounts, stripeEvents, subscriptions, usageRecords, users } from "@/server/db/schema";
import { currentMonth } from "@/server/usage";
import { call, createAdmin, createTestDb, createUser, resetTestDb } from "@/test/server";
import { DELETE as deleteAccount } from "../auth/delete/route";
import { POST as confirm } from "./confirm/route";
import { POST as checkout } from "./create-checkout-session/route";
import { POST as portal } from "./portal/route";
import { GET as subscription } from "./subscription/route";
import { GET as usage } from "./usage/route";
import { POST as webhook } from "./webhook/route";

const WEBHOOK_SECRET = "whsec_test";
const stripeMock = vi.hoisted(() => ({
  checkoutCreate: vi.fn(),
  checkoutRetrieve: vi.fn(),
  subscriptionRetrieve: vi.fn(),
  subscriptionCancel: vi.fn(),
  portalCreate: vi.fn(),
}));
vi.mock("@/server/stripe", async () => {
  const { default: RealStripe } = await import("stripe");
  const real = new RealStripe("sk_test_dummy");
  return {
    stripe: () => ({
      checkout: { sessions: { create: stripeMock.checkoutCreate, retrieve: stripeMock.checkoutRetrieve } },
      subscriptions: { retrieve: stripeMock.subscriptionRetrieve, cancel: stripeMock.subscriptionCancel },
      billingPortal: { sessions: { create: stripeMock.portalCreate } },
      webhooks: real.webhooks,
    }),
  };
});
const storage = vi.hoisted(() => ({ deleteFromStorage: vi.fn(async () => {}), uploadToStorage: vi.fn() }));
vi.mock("@/server/storage", () => storage);

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", WEBHOOK_SECRET);
  vi.stubEnv("STRIPE_PRICE_ID_PRO_MONTHLY", "price_pro");
});
beforeEach(async () => {
  await resetTestDb(db);
  vi.clearAllMocks();
});

let eventCounter = 0;
function signedEvent(type: string, object: Record<string, unknown>, id = `evt_${++eventCounter}`) {
  const payload = JSON.stringify({ id, object: "event", type, data: { object } });
  const header = new Stripe("sk_test_dummy").webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
  return { body: payload, headers: { "stripe-signature": header } };
}

/** A Stripe subscription as `subscriptions.retrieve` returns it (only the fields we read). */
function stripeSubscription(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub_1",
    customer: "cus_1",
    status: "active",
    metadata: {},
    cancel_at_period_end: false,
    cancel_at: null,
    items: { data: [{ current_period_start: 1790121600, current_period_end: 1792800000 }] }, // 2026-09-23 → 2026-10-24
    ...overrides,
  };
}

describe("usage and subscription", () => {
  it("reports this month's usage and the free limit", async () => {
    const { user, token } = await createUser(db);
    await db.insert(usageRecords).values({ userId: user.id, month: currentMonth(), documentsProcessed: 3 });
    await db.insert(usageRecords).values({ userId: user.id, month: new Date(Date.UTC(2020, 0, 1)), documentsProcessed: 9 });
    expect((await call(usage, "GET", "/billing/usage", { token })).json).toEqual({ plan: "free", documents_processed: 3, limit: 10 });
  });

  it("reports unlimited for Pro", async () => {
    const { token } = await createUser(db, { plan: "pro" });
    expect((await call(usage, "GET", "/billing/usage", { token })).json).toEqual({ plan: "pro", documents_processed: 0, limit: -1 });
  });

  it("returns inactive without a subscription, billing dates with one", async () => {
    const { user, token } = await createUser(db, { plan: "pro" });
    expect((await call(subscription, "GET", "/billing/subscription", { token })).json).toEqual({
      plan: "pro",
      status: "inactive",
      current_period_end: null,
      last_renewal_date: null,
      cancel_at_period_end: false,
      can_manage: false,
    });
    await db.insert(subscriptions).values({
      userId: user.id,
      plan: "pro",
      status: "active",
      stripeCustomerId: "cus_1",
      currentPeriodStart: new Date("2026-09-23T00:00:00Z"),
      currentPeriodEnd: new Date("2026-10-23T00:00:00Z"),
      cancelAtPeriodEnd: true,
    });
    expect((await call(subscription, "GET", "/billing/subscription", { token })).json).toEqual({
      plan: "pro",
      status: "active",
      current_period_end: "2026-10-23T00:00:00.000Z",
      last_renewal_date: "2026-09-23T00:00:00.000Z",
      cancel_at_period_end: true,
      can_manage: true,
    });
  });

  it("is for customers only", async () => {
    const { token } = await createAdmin(db);
    expect((await call(usage, "GET", "/billing/usage", { token })).status).toBe(403);
    expect((await call(checkout, "POST", "/billing/create-checkout-session", { token })).status).toBe(403);
  });
});

describe("checkout", () => {
  it("creates a subscription checkout that returns with the session id", async () => {
    const { user, token } = await createUser(db);
    stripeMock.checkoutCreate.mockResolvedValueOnce({ url: "https://checkout.stripe.test/s" });
    const res = await call(checkout, "POST", "/billing/create-checkout-session", { token });
    expect(res.json).toEqual({ url: "https://checkout.stripe.test/s" });
    expect(stripeMock.checkoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        line_items: [{ price: "price_pro", quantity: 1 }],
        client_reference_id: user.id,
        customer_email: "ada@example.com",
        subscription_data: { metadata: { user_id: user.id } },
        success_url: "http://localhost:3000/billing/success?session_id={CHECKOUT_SESSION_ID}",
        cancel_url: "http://localhost:3000/billing/cancelled",
      })
    );
  });

  it("reuses the customer from an earlier subscription", async () => {
    const { user, token } = await createUser(db);
    await db.insert(subscriptions).values({ userId: user.id, status: "canceled", stripeCustomerId: "cus_old" });
    stripeMock.checkoutCreate.mockResolvedValueOnce({ url: "https://checkout.stripe.test/s" });
    await call(checkout, "POST", "/billing/create-checkout-session", { token });
    const params = stripeMock.checkoutCreate.mock.calls[0][0];
    expect(params.customer).toBe("cus_old");
    expect(params.customer_email).toBeUndefined();
  });

  it("refuses anyone already subscribed, and hides Stripe's error text", async () => {
    const pro = await createUser(db, { plan: "pro" });
    expect((await call(checkout, "POST", "/billing/create-checkout-session", { token: pro.token })).status).toBe(400);

    // Plan says free but a live subscription exists (e.g. an admin revoked Pro): no second subscription.
    const comped = await createUser(db, { username: "c@test.com" });
    await db.insert(subscriptions).values({ userId: comped.user.id, status: "past_due", stripeCustomerId: "cus_2" });
    expect((await call(checkout, "POST", "/billing/create-checkout-session", { token: comped.token })).status).toBe(400);

    const free = await createUser(db, { username: "free@test.com" });
    stripeMock.checkoutCreate.mockRejectedValueOnce(new Error("No such price: price_secret"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await call(checkout, "POST", "/billing/create-checkout-session", { token: free.token });
    expect(res).toMatchObject({ status: 502, json: { detail: "Couldn't start checkout. Please try again." } });
  });
});

describe("confirm (post-checkout)", () => {
  it("upgrades straight from Stripe's checkout and returns a fresh Pro token", async () => {
    const { user, token } = await createUser(db);
    stripeMock.checkoutRetrieve.mockResolvedValueOnce({ id: "cs_test_1", client_reference_id: user.id, mode: "subscription", status: "complete", subscription: "sub_1" });
    stripeMock.subscriptionRetrieve.mockResolvedValueOnce(stripeSubscription());

    const res = await call(confirm, "POST", "/billing/confirm", { token, body: { session_id: "cs_test_1" } });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ plan: "pro", status: "complete", role: "user" });
    expect(await decodeAccessToken(res.json.access_token)).toMatchObject({ plan: "pro" });
    expect((await db.select().from(subscriptions))[0]).toMatchObject({
      userId: user.id,
      status: "active",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
      currentPeriodEnd: new Date(1792800000 * 1000),
    });
  });

  it("won't redeem another account's checkout", async () => {
    const { token } = await createUser(db);
    stripeMock.checkoutRetrieve.mockResolvedValueOnce({ id: "cs_test_1", client_reference_id: "someone-else", mode: "subscription", status: "complete", subscription: "sub_1" });
    expect((await call(confirm, "POST", "/billing/confirm", { token, body: { session_id: "cs_test_1" } })).status).toBe(404);
    expect(stripeMock.subscriptionRetrieve).not.toHaveBeenCalled();
    expect((await db.select().from(users))[0].plan).toBe("free");
  });

  it("answers 202 while the checkout is still open, and validates the id", async () => {
    const { user, token } = await createUser(db);
    stripeMock.checkoutRetrieve.mockResolvedValueOnce({ id: "cs_test_1", client_reference_id: user.id, mode: "subscription", status: "open", subscription: null });
    expect(await call(confirm, "POST", "/billing/confirm", { token, body: { session_id: "cs_test_1" } })).toMatchObject({ status: 202, json: { plan: "free" } });
    expect((await call(confirm, "POST", "/billing/confirm", { token, body: { session_id: "../evil" } })).status).toBe(422);
    stripeMock.checkoutRetrieve.mockRejectedValueOnce(new Error("No such checkout.session"));
    expect((await call(confirm, "POST", "/billing/confirm", { token, body: { session_id: "cs_missing" } })).status).toBe(404);
  });
});

describe("billing portal", () => {
  it("opens the Stripe portal for subscribers and returns to the account page", async () => {
    const { user, token } = await createUser(db, { plan: "pro" });
    expect((await call(portal, "POST", "/billing/portal", { token })).status).toBe(400);

    await db.insert(subscriptions).values({ userId: user.id, status: "active", stripeCustomerId: "cus_1" });
    stripeMock.portalCreate.mockResolvedValueOnce({ url: "https://billing.stripe.test/p" });
    expect((await call(portal, "POST", "/billing/portal", { token })).json).toEqual({ url: "https://billing.stripe.test/p" });
    expect(stripeMock.portalCreate).toHaveBeenCalledWith({ customer: "cus_1", return_url: "http://localhost:3000/account" });
  });
});

describe("webhook", () => {
  it("rejects bad signatures without echoing details", async () => {
    const res = await call(webhook, "POST", "/billing/webhook", { body: "{}", headers: { "stripe-signature": "t=1,v1=bad" } });
    expect(res).toMatchObject({ status: 400, json: { detail: "Webhook error: invalid signature" } });
  });

  it("upgrades on checkout.session.completed, applying the subscription as Stripe has it now", async () => {
    const { user } = await createUser(db);
    stripeMock.subscriptionRetrieve.mockResolvedValue(stripeSubscription());
    const event = signedEvent("checkout.session.completed", { mode: "subscription", client_reference_id: user.id, customer: "cus_1", subscription: "sub_1" }, "evt_checkout");
    const res = await call(webhook, "POST", "/billing/webhook", event);
    expect(res.json).toEqual({ status: "success" });
    expect(stripeMock.subscriptionRetrieve).toHaveBeenCalledWith("sub_1");
    expect((await db.select().from(users))[0].plan).toBe("pro");
    expect((await db.select().from(subscriptions))[0]).toMatchObject({ plan: "pro", status: "active", stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1" });

    // A replayed event is acknowledged without being applied again.
    const replay = await call(webhook, "POST", "/billing/webhook", event);
    expect(replay.json).toEqual({ status: "success", duplicate: true });
    expect(stripeMock.subscriptionRetrieve).toHaveBeenCalledTimes(1);
    expect(await db.select().from(subscriptions)).toHaveLength(1);
    expect(await db.select().from(stripeEvents)).toHaveLength(1);
  });

  it("keeps Pro through past_due (Stripe is retrying) and drops it once the subscription ends", async () => {
    const { user } = await createUser(db, { plan: "pro" });
    await db.insert(subscriptions).values({ userId: user.id, plan: "pro", status: "active", stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1" });

    stripeMock.subscriptionRetrieve.mockResolvedValueOnce(stripeSubscription({ status: "past_due" }));
    await call(webhook, "POST", "/billing/webhook", signedEvent("invoice.payment_failed", { parent: { subscription_details: { subscription: "sub_1" } } }));
    expect((await db.select().from(users).where(eq(users.id, user.id)))[0].plan).toBe("pro");
    expect((await db.select().from(subscriptions))[0].status).toBe("past_due");

    stripeMock.subscriptionRetrieve.mockResolvedValueOnce(stripeSubscription({ status: "canceled" }));
    await call(webhook, "POST", "/billing/webhook", signedEvent("customer.subscription.deleted", { id: "sub_1" }));
    expect((await db.select().from(users))[0].plan).toBe("free");
    expect((await db.select().from(subscriptions))[0]).toMatchObject({ plan: "free", status: "canceled" });
  });

  it("records a scheduled cancellation", async () => {
    const { user } = await createUser(db, { plan: "pro" });
    await db.insert(subscriptions).values({ userId: user.id, plan: "pro", status: "active", stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1" });
    stripeMock.subscriptionRetrieve.mockResolvedValueOnce(stripeSubscription({ cancel_at_period_end: true }));
    await call(webhook, "POST", "/billing/webhook", signedEvent("customer.subscription.updated", { id: "sub_1" }));
    expect((await db.select().from(subscriptions))[0]).toMatchObject({ status: "active", cancelAtPeriodEnd: true });
    expect((await db.select().from(users))[0].plan).toBe("pro");
  });

  it("finds the owner from subscription metadata when its event beats checkout's", async () => {
    const { user } = await createUser(db);
    stripeMock.subscriptionRetrieve.mockResolvedValueOnce(stripeSubscription({ metadata: { user_id: user.id } }));
    await call(webhook, "POST", "/billing/webhook", signedEvent("customer.subscription.created", { id: "sub_1" }));
    expect((await db.select().from(users))[0].plan).toBe("pro");
  });

  it("never lets an old subscription's end downgrade a newer live one", async () => {
    const { user } = await createUser(db, { plan: "pro" });
    await db.insert(subscriptions).values({ userId: user.id, plan: "pro", status: "active", stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_new" });
    stripeMock.subscriptionRetrieve.mockResolvedValueOnce(stripeSubscription({ id: "sub_old", status: "canceled", metadata: { user_id: user.id } }));
    await call(webhook, "POST", "/billing/webhook", signedEvent("customer.subscription.deleted", { id: "sub_old" }));
    expect((await db.select().from(users))[0].plan).toBe("pro");
    expect((await db.select().from(subscriptions))[0].stripeSubscriptionId).toBe("sub_new");
  });

  it("flags a second live subscription for the same customer", async () => {
    const { user } = await createUser(db, { plan: "pro" });
    await db.insert(subscriptions).values({ userId: user.id, plan: "pro", status: "active", stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_first" });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    stripeMock.subscriptionRetrieve.mockResolvedValueOnce(stripeSubscription({ id: "sub_second", metadata: { user_id: user.id } }));
    await call(webhook, "POST", "/billing/webhook", signedEvent("customer.subscription.created", { id: "sub_second" }));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"event":"duplicate_subscription"'));
    expect((await db.select().from(subscriptions))[0].stripeSubscriptionId).toBe("sub_second");
  });

  it("acknowledges and ignores events for unknown customers, deleted users and unrelated types", async () => {
    stripeMock.subscriptionRetrieve.mockResolvedValueOnce(stripeSubscription({ customer: "cus_x" }));
    expect((await call(webhook, "POST", "/billing/webhook", signedEvent("customer.subscription.updated", { id: "sub_x" }))).status).toBe(200);
    stripeMock.subscriptionRetrieve.mockResolvedValueOnce(stripeSubscription({ metadata: { user_id: "deleted-user" } }));
    expect((await call(webhook, "POST", "/billing/webhook", signedEvent("customer.subscription.updated", { id: "sub_y" }))).status).toBe(200);
    expect((await call(webhook, "POST", "/billing/webhook", signedEvent("charge.refunded", {}))).status).toBe(200);
    expect((await call(webhook, "POST", "/billing/webhook", signedEvent("checkout.session.completed", { mode: "payment" }))).status).toBe(200);
    expect(await db.select().from(subscriptions)).toEqual([]);
  });
});

describe("account deletion and billing", () => {
  it("cancels a live subscription before deleting the account (regression: deleted customers kept being billed)", async () => {
    const { user, token } = await createUser(db, { plan: "pro" });
    await db.insert(subscriptions).values({ userId: user.id, status: "active", stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1" });
    expect((await call(deleteAccount, "DELETE", "/auth/delete", { token })).status).toBe(204);
    expect(stripeMock.subscriptionCancel).toHaveBeenCalledWith("sub_1");
    expect(await db.select().from(users)).toEqual([]);
  });

  it("keeps a record of the deleted account and its subscription", async () => {
    const { user, token } = await createUser(db, { plan: "pro" });
    await db.insert(subscriptions).values({
      userId: user.id,
      status: "active",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
      currentPeriodEnd: new Date("2026-11-01T00:00:00Z"),
    });
    await db.insert(usageRecords).values([
      { userId: user.id, month: new Date(Date.UTC(2026, 8, 1)), documentsProcessed: 12 },
      { userId: user.id, month: new Date(Date.UTC(2026, 9, 1)), documentsProcessed: 3 },
    ]);
    await call(deleteAccount, "DELETE", "/auth/delete", { token });

    const [record] = await db.select().from(deletedAccounts);
    expect(record).toMatchObject({
      userId: user.id,
      username: "ada@example.com",
      role: "user",
      plan: "pro",
      deletedBy: "self",
      deletedByAdminId: null,
      lifetimeDocuments: 15,
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
      subscriptionStatusAtDeletion: "active",
      subscriptionStatus: "canceled",
      currentPeriodEnd: new Date("2026-11-01T00:00:00Z"),
    });
    expect(record.billingCancelledAt).toBeInstanceOf(Date);
    expect(record.accountCreatedAt).toEqual(user.createdAt);
  });

  it("keeps following a deleted account's subscription through the webhook", async () => {
    const { user, token } = await createUser(db, { plan: "pro" });
    await db.insert(subscriptions).values({ userId: user.id, status: "active", stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1" });
    await call(deleteAccount, "DELETE", "/auth/delete", { token });

    // Stripe confirms the cancellation after the account is gone: recorded, nothing else to do.
    stripeMock.subscriptionRetrieve.mockResolvedValueOnce(stripeSubscription({ status: "canceled", items: { data: [{ current_period_end: 1795392000 }] } }));
    expect((await call(webhook, "POST", "/billing/webhook", signedEvent("customer.subscription.deleted", { id: "sub_1" }))).status).toBe(200);
    expect((await db.select().from(deletedAccounts))[0]).toMatchObject({ subscriptionStatus: "canceled", currentPeriodEnd: new Date(1795392000 * 1000) });
    expect(stripeMock.subscriptionCancel).toHaveBeenCalledTimes(1); // only the deletion's own cancel
    expect(await db.select().from(subscriptions)).toEqual([]);
  });

  it("cancels a subscription that turns up for a deleted account (checkout finished after deleting)", async () => {
    const { user, token } = await createUser(db);
    await call(deleteAccount, "DELETE", "/auth/delete", { token });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    stripeMock.subscriptionRetrieve.mockResolvedValueOnce(stripeSubscription({ id: "sub_late", customer: "cus_late" }));
    await call(webhook, "POST", "/billing/webhook", signedEvent("checkout.session.completed", { mode: "subscription", client_reference_id: user.id, subscription: "sub_late" }));

    expect(stripeMock.subscriptionCancel).toHaveBeenCalledWith("sub_late");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"event":"billing_after_deletion_cancelled"'));
    const [record] = await db.select().from(deletedAccounts);
    expect(record).toMatchObject({ stripeSubscriptionId: "sub_late", stripeCustomerId: "cus_late", subscriptionStatus: "canceled", subscriptionStatusAtDeletion: null });
    expect(record.billingCancelledAt).toBeInstanceOf(Date);
    expect(await db.select().from(users)).toEqual([]); // nothing is resurrected
  });

  it("keeps the account if Stripe can't cancel, but tolerates one that's already gone", async () => {
    const { user, token } = await createUser(db, { plan: "pro" });
    await db.insert(subscriptions).values({ userId: user.id, status: "active", stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1" });
    vi.spyOn(console, "error").mockImplementation(() => {});
    stripeMock.subscriptionCancel.mockRejectedValueOnce(Object.assign(new Error("Stripe down"), { code: "api_error" }));
    expect((await call(deleteAccount, "DELETE", "/auth/delete", { token })).status).toBe(500);
    expect(await db.select().from(users)).toHaveLength(1);

    expect(await db.select().from(deletedAccounts)).toEqual([]); // no record without a deletion

    stripeMock.subscriptionCancel.mockRejectedValueOnce(Object.assign(new Error("No such subscription"), { code: "resource_missing" }));
    expect((await call(deleteAccount, "DELETE", "/auth/delete", { token })).status).toBe(204);
    // Already gone on Stripe's side: ended, but not something Tallyhawk cancelled.
    expect((await db.select().from(deletedAccounts))[0]).toMatchObject({ subscriptionStatus: "canceled", billingCancelledAt: null });
  });

  it("doesn't call Stripe for ended subscriptions", async () => {
    const { user, token } = await createUser(db);
    await db.insert(subscriptions).values({ userId: user.id, status: "canceled", stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1" });
    expect((await call(deleteAccount, "DELETE", "/auth/delete", { token })).status).toBe(204);
    expect(stripeMock.subscriptionCancel).not.toHaveBeenCalled();
    expect((await db.select().from(deletedAccounts))[0]).toMatchObject({ subscriptionStatusAtDeletion: "canceled", subscriptionStatus: "canceled", billingCancelledAt: null });
  });
});
