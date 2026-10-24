import { getDb } from "@/server/db";
import { subscriptionOf } from "@/server/billing";
import { getCurrentUser, json, route } from "@/server/http";

export const GET = route(async (request) => {
  const user = await getCurrentUser(request);
  const sub = await subscriptionOf(getDb(), user.id);

  if (!sub || sub.status === "inactive") {
    return json({
      plan: user.plan,
      status: "inactive",
      current_period_end: null,
      last_renewal_date: null,
      cancel_at_period_end: false,
      can_manage: Boolean(sub?.stripeCustomerId),
    });
  }
  return json({
    plan: user.plan,
    status: sub.status,
    current_period_end: sub.currentPeriodEnd?.toISOString() ?? null,
    // The start of the current billing period is when it last renewed (or began).
    last_renewal_date: (sub.currentPeriodStart ?? sub.updatedAt).toISOString(),
    cancel_at_period_end: sub.cancelAtPeriodEnd,
    can_manage: Boolean(sub.stripeCustomerId),
  });
});
