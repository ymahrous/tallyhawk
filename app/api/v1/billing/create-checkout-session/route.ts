import { getDb } from "@/server/db";
import { planForStatus, subscriptionOf } from "@/server/billing";
import { ApiError, appUrl, getCurrentUser, json, route } from "@/server/http";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { stripe } from "@/server/stripe";

export const POST = route(async (request) => {
  const user = await getCurrentUser(request);
  if (user.plan === "pro") throw new ApiError(400, "Already on Pro plan");
  await rateLimit("checkout", user.id, LIMITS.checkoutPerUser);

  const existing = await subscriptionOf(getDb(), user.id);
  if (existing && planForStatus(existing.status) === "pro") throw new ApiError(400, "Already on Pro plan");

  const origin = appUrl(request);
  try {
    const session = await stripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: process.env.STRIPE_PRICE_ID_PRO_MONTHLY, quantity: 1 }],
      client_reference_id: user.id,
      // Reuse the Stripe customer from an earlier subscription, so one person is one customer.
      ...(existing?.stripeCustomerId ? { customer: existing.stripeCustomerId } : { customer_email: user.username }),
      // Lets every later subscription event find its owner, even one that arrives before checkout's.
      subscription_data: { metadata: { user_id: user.id } },
      metadata: { user_id: user.id },
      // {CHECKOUT_SESSION_ID} is filled in by Stripe; the success page confirms it via POST /billing/confirm.
      success_url: `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/billing/cancelled`,
    });
    if (!session.url) throw new Error("Checkout session has no URL");
    return json({ url: session.url });
  } catch (error) {
    // Stripe's message can name prices and accounts; log it, don't show it.
    console.error(JSON.stringify({ level: "error", event: "checkout_failed", error: String(error) }));
    throw new ApiError(502, "Couldn't start checkout. Please try again.");
  }
});
