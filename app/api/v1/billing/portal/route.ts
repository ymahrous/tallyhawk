import { getDb } from "@/server/db";
import { subscriptionOf } from "@/server/billing";
import { ApiError, appUrl, getCurrentUser, json, route } from "@/server/http";
import { stripe } from "@/server/stripe";

/** A Stripe Customer Portal link, where subscribers update their card, see invoices or cancel. */
export const POST = route(async (request) => {
  const user = await getCurrentUser(request);
  const sub = await subscriptionOf(getDb(), user.id);
  if (!sub?.stripeCustomerId) throw new ApiError(400, "No billing account yet. Upgrade to Pro first.");

  try {
    const session = await stripe().billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${appUrl(request)}/account`,
    });
    return json({ url: session.url });
  } catch (error) {
    console.error(JSON.stringify({ level: "error", event: "billing_portal_failed", error: String(error) }));
    throw new ApiError(502, "Couldn't open the billing portal. Please try again.");
  }
});
