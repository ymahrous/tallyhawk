import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { getDb } from "@/server/db";
import { subscriptions, users } from "@/server/db/schema";
import { ApiError, json, route } from "@/server/http";
import { stripe } from "@/server/stripe";

// Called by Stripe, not the browser. Point the Stripe dashboard's webhook endpoint at
// `<APP_URL>/api/v1/billing/webhook`.

function idOf(value: string | { id: string } | null): string | null {
  return typeof value === "string" ? value : (value?.id ?? null);
}

export const POST = route(async (request) => {
  const payload = await request.text(); // signature is computed over the raw body
  const signature = request.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET ?? "");
  } catch (error) {
    throw new ApiError(400, `Webhook error: ${error instanceof Error ? error.message : String(error)}`);
  }

  const db = getDb();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = session.client_reference_id;
    if (userId) {
      const values = {
        plan: "pro",
        stripeCustomerId: idOf(session.customer),
        stripeSubscriptionId: idOf(session.subscription),
        status: "active",
        updatedAt: new Date(),
      };
      await db.transaction(async (tx) => {
        await tx
          .insert(subscriptions)
          .values({ userId, ...values })
          .onConflictDoUpdate({ target: subscriptions.userId, set: values });
        await tx.update(users).set({ plan: "pro" }).where(eq(users.id, userId));
      });
    }
  } else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const subscription = event.data.object;
    const customerId = idOf(subscription.customer);
    const plan = subscription.status === "active" ? "pro" : "free";

    if (customerId) {
      const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.stripeCustomerId, customerId)).limit(1);
      if (sub) {
        await db.transaction(async (tx) => {
          await tx.update(subscriptions).set({ status: subscription.status, plan, updatedAt: new Date() }).where(eq(subscriptions.id, sub.id));
          await tx.update(users).set({ plan }).where(eq(users.id, sub.userId));
        });
      }
    }
  }

  return json({ status: "success" });
});
