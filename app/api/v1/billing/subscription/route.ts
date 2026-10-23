import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { subscriptions } from "@/server/db/schema";
import { getCurrentUser, json, route } from "@/server/http";

export const GET = route(async (request) => {
  const user = await getCurrentUser(request);
  const [sub] = await getDb().select().from(subscriptions).where(eq(subscriptions.userId, user.id)).limit(1);

  if (!sub || sub.status !== "active") {
    return json({ plan: user.plan, status: "inactive", current_period_end: null, last_renewal_date: null });
  }
  return json({
    plan: user.plan,
    status: sub.status,
    current_period_end: sub.currentPeriodEnd?.toISOString() ?? null,
    last_renewal_date: sub.updatedAt.toISOString(),
  });
});
