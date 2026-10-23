// @vitest-environment node
import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/server/db";
import { subscriptions, usageRecords, users } from "@/server/db/schema";
import { currentMonth } from "@/server/usage";
import { call, createTestDb, createUser, resetTestDb } from "@/test/server";
import { POST as checkout } from "./create-checkout-session/route";
import { GET as subscription } from "./subscription/route";
import { GET as usage } from "./usage/route";
import { POST as webhook } from "./webhook/route";

const WEBHOOK_SECRET = "whsec_test";
const checkoutCreate = vi.hoisted(() => vi.fn());
vi.mock("@/server/stripe", async () => {
  const { default: RealStripe } = await import("stripe");
  const real = new RealStripe("sk_test_dummy");
  return { stripe: () => ({ checkout: { sessions: { create: checkoutCreate } }, webhooks: real.webhooks }) };
});

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

function signedEvent(type: string, object: Record<string, unknown>) {
  const payload = JSON.stringify({ id: "evt_1", object: "event", type, data: { object } });
  const header = new Stripe("sk_test_dummy").webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
  return { body: payload, headers: { "stripe-signature": header } };
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

  it("returns inactive without an active subscription, details with one", async () => {
    const { user, token } = await createUser(db, { plan: "pro" });
    expect((await call(subscription, "GET", "/billing/subscription", { token })).json).toEqual({
      plan: "pro",
      status: "inactive",
      current_period_end: null,
      last_renewal_date: null,
    });
    const updatedAt = new Date("2026-09-23T00:00:00Z");
    await db.insert(subscriptions).values({ userId: user.id, plan: "pro", status: "active", updatedAt, currentPeriodEnd: new Date("2026-10-23T00:00:00Z") });
    expect((await call(subscription, "GET", "/billing/subscription", { token })).json).toEqual({
      plan: "pro",
      status: "active",
      current_period_end: "2026-10-23T00:00:00.000Z",
      last_renewal_date: "2026-09-23T00:00:00.000Z",
    });
  });
});

describe("checkout", () => {
  it("creates a subscription checkout returning to this app", async () => {
    const { user, token } = await createUser(db);
    checkoutCreate.mockResolvedValueOnce({ url: "https://checkout.stripe.test/s" });
    const res = await call(checkout, "POST", "/billing/create-checkout-session", { token });
    expect(res.json).toEqual({ url: "https://checkout.stripe.test/s" });
    expect(checkoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        line_items: [{ price: "price_pro", quantity: 1 }],
        client_reference_id: user.id,
        success_url: "http://localhost:3000/billing/success",
        cancel_url: "http://localhost:3000/pricing",
      })
    );
  });

  it("refuses Pro users and surfaces Stripe errors", async () => {
    const pro = await createUser(db, { plan: "pro" });
    expect((await call(checkout, "POST", "/billing/create-checkout-session", { token: pro.token })).status).toBe(400);
    const free = await createUser(db, { username: "free@test.com" });
    checkoutCreate.mockRejectedValueOnce(new Error("No such price"));
    const res = await call(checkout, "POST", "/billing/create-checkout-session", { token: free.token });
    expect(res).toMatchObject({ status: 500, json: { detail: "No such price" } });
  });
});

describe("webhook", () => {
  it("rejects bad signatures", async () => {
    const res = await call(webhook, "POST", "/billing/webhook", { body: "{}", headers: { "stripe-signature": "t=1,v1=bad" } });
    expect(res.status).toBe(400);
    expect(res.json.detail).toMatch(/^Webhook error/);
  });

  it("upgrades the user on checkout.session.completed", async () => {
    const { user } = await createUser(db);
    const res = await call(webhook, "POST", "/billing/webhook", signedEvent("checkout.session.completed", { client_reference_id: user.id, customer: "cus_1", subscription: "sub_1" }));
    expect(res.json).toEqual({ status: "success" });
    expect((await db.select().from(users))[0].plan).toBe("pro");
    expect((await db.select().from(subscriptions))[0]).toMatchObject({ plan: "pro", status: "active", stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1" });

    // Replayed event: still exactly one subscription row.
    await call(webhook, "POST", "/billing/webhook", signedEvent("checkout.session.completed", { client_reference_id: user.id, customer: "cus_1", subscription: "sub_1" }));
    expect(await db.select().from(subscriptions)).toHaveLength(1);
  });

  it("downgrades when the subscription stops being active", async () => {
    const { user } = await createUser(db, { plan: "pro" });
    await db.insert(subscriptions).values({ userId: user.id, plan: "pro", status: "active", stripeCustomerId: "cus_1" });

    await call(webhook, "POST", "/billing/webhook", signedEvent("customer.subscription.updated", { customer: "cus_1", status: "past_due" }));
    expect((await db.select().from(users).where(eq(users.id, user.id)))[0].plan).toBe("free");
    expect((await db.select().from(subscriptions))[0]).toMatchObject({ plan: "free", status: "past_due" });

    await call(webhook, "POST", "/billing/webhook", signedEvent("customer.subscription.updated", { customer: "cus_1", status: "active" }));
    expect((await db.select().from(users))[0].plan).toBe("pro");

    // Unknown customers and unrelated events are acknowledged and ignored.
    expect((await call(webhook, "POST", "/billing/webhook", signedEvent("customer.subscription.deleted", { customer: "cus_x", status: "canceled" }))).status).toBe(200);
    expect((await call(webhook, "POST", "/billing/webhook", signedEvent("invoice.paid", {}))).status).toBe(200);
  });
});
