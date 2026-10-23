import { ApiError, appUrl, getCurrentUser, json, route } from "@/server/http";
import { stripe } from "@/server/stripe";

export const POST = route(async (request) => {
  const user = await getCurrentUser(request);
  if (user.plan === "pro") throw new ApiError(400, "Already on Pro plan");

  const origin = appUrl(request);
  try {
    const session = await stripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: process.env.STRIPE_PRICE_ID_PRO_MONTHLY, quantity: 1 }],
      client_reference_id: user.id,
      success_url: `${origin}/billing/success`,
      cancel_url: `${origin}/pricing`,
    });
    return json({ url: session.url });
  } catch (error) {
    throw new ApiError(500, error instanceof Error ? error.message : String(error));
  }
});
