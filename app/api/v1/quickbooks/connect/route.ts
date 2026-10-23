import { createAccessToken } from "@/server/auth";
import { ApiError, getCurrentUser, json, route } from "@/server/http";
import { QB_AUTH_URL, QB_SCOPE, qbConfig } from "@/server/quickbooks";

/** Returns the Intuit authorization URL for the frontend to redirect to. */
export const GET = route(async (request) => {
  const user = await getCurrentUser(request);
  const { clientId, redirectUri } = qbConfig();
  if (!clientId || !redirectUri) throw new ApiError(500, "QuickBooks integration not configured on server.");

  // `state` is a short-lived signed token rather than the bare user id, so a forged callback can't
  // attach someone else's QuickBooks company to this account.
  const state = await createAccessToken({ sub: user.id, role: "qb_oauth" }, 15 * 60);
  const params = new URLSearchParams({
    client_id: clientId,
    scope: QB_SCOPE,
    redirect_uri: redirectUri,
    response_type: "code",
    state,
  });
  return json({ url: `${QB_AUTH_URL}?${params}` });
});
