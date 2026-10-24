import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { idOf, retrieveSubscription, syncSubscription } from "@/server/billing";
import { getDb } from "@/server/db";
import { stripeEvents } from "@/server/db/schema";
import { ApiError, json, route } from "@/server/http";
import { stripe } from "@/server/stripe";

// Called by Stripe, not the browser. Point the Stripe dashboard's webhook endpoint at
// `<APP_URL>/api/v1/billing/webhook` and send it the events handled below.

/** The subscription an event is about, if it's one we act on. */
function subscriptionIdOf(event: Stripe.Event): { id: string; userId?: string | null } | null {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
    case "checkout.session.async_payment_failed": {
      const session = event.data.object;
      const id = session.mode === "subscription" ? idOf(session.subscription) : null;
      return id ? { id, userId: session.client_reference_id } : null;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed":
      return { id: event.data.object.id };
    case "invoice.paid":
    case "invoice.payment_failed": {
      const id = idOf(event.data.object.parent?.subscription_details?.subscription);
      return id ? { id } : null;
    }
    default:
      return null;
  }
}

export const POST = route(async (request) => {
  const payload = await request.text(); // signature is computed over the raw body
  const signature = request.headers.get("stripe-signature") ?? "";
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new ApiError(500, "Webhook not configured");

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(payload, signature, secret);
  } catch {
    throw new ApiError(400, "Webhook error: invalid signature");
  }

  const db = getDb();
  const [seen] = await db.select({ id: stripeEvents.id }).from(stripeEvents).where(eq(stripeEvents.id, event.id)).limit(1);
  if (seen) return json({ status: "success", duplicate: true });

  // Always apply the subscription as Stripe reports it now, not the snapshot in the event: events
  // can arrive late or out of order, and the latest state is the only one that's right.
  const target = subscriptionIdOf(event);
  if (target) await syncSubscription(db, await retrieveSubscription(target.id), target.userId);

  await db.insert(stripeEvents).values({ id: event.id, type: event.type }).onConflictDoNothing();
  return json({ status: "success" });
});
