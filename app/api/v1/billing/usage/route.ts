import { getCurrentUser, json, route } from "@/server/http";
import { documentsProcessedThisMonth, FREE_TIER_LIMIT } from "@/server/usage";

export const GET = route(async (request) => {
  const user = await getCurrentUser(request);
  return json({
    plan: user.plan,
    documents_processed: await documentsProcessedThisMonth(user.id),
    limit: user.plan === "free" ? FREE_TIER_LIMIT : -1, // -1 means unlimited
  });
});
