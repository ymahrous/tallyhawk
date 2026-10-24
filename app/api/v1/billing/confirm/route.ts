import { eq } from "drizzle-orm";
import { z } from "zod";
import { issueSession } from "@/server/accounts";
import { idOf, retrieveSubscription, syncSubscription } from "@/server/billing";
import { getDb } from "@/server/db";
import { users } from "@/server/db/schema";
import { ApiError, getCurrentUser, json, parseJson, route } from "@/server/http";
import { stripe } from "@/server/stripe";

const Body = z.object({ session_id: z.string().regex(/^cs_[A-Za-z0-9_]+$/, "Invalid checkout session.").max(255) });

/**
 * Called by /billing/success with the session id Stripe appended to the return URL. Reads the
 * checkout straight from Stripe and applies it, so the upgrade doesn't wait on (or depend on) the
 * webhook. Answers with the plan and a fresh session token carrying it.
 */
export const POST = route(async (request) => {
  const user = await getCurrentUser(request);
  const { session_id } = await parseJson(request, Body);
  const db = getDb();

  let session;
  try {
    session = await stripe().checkout.sessions.retrieve(session_id);
  } catch {
    throw new ApiError(404, "Checkout session not found.");
  }
  // Only the account that started the checkout can redeem it.
  if (session.client_reference_id !== user.id) throw new ApiError(404, "Checkout session not found.");
  if (session.mode !== "subscription" || session.status !== "complete") {
    return json({ plan: user.plan, status: session.status ?? "open" }, { status: 202 });
  }

  const subscriptionId = idOf(session.subscription);
  if (subscriptionId) await syncSubscription(db, await retrieveSubscription(subscriptionId), user.id);

  const [fresh] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  return json({ plan: fresh.plan, status: "complete", ...(await issueSession(fresh)) });
});
