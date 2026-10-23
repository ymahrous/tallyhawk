import { decodeAccessToken } from "@/server/auth";
import { getDb } from "@/server/db";
import { quickbooksConnections } from "@/server/db/schema";
import { appUrl, route } from "@/server/http";
import { qbConfig, requestQbTokens, type QbTokens } from "@/server/quickbooks";

// Intuit redirects the browser here (QB_REDIRECT_URI = <APP_URL>/api/v1/quickbooks/callback).
// Every outcome redirects back to the account page with a status flag.
export const GET = route(async (request) => {
  const url = new URL(request.url);
  const back = (flag: string) => Response.redirect(`${appUrl(request)}/account?${flag}`, 302);

  const code = url.searchParams.get("code");
  const realmId = url.searchParams.get("realmId");
  const state = await decodeAccessToken(url.searchParams.get("state") ?? "");
  if (!state || state.role !== "qb_oauth" || !state.sub || !code) return back("qb_error=invalid_state");
  if (!realmId) return back("qb_error=missing_realm");

  const res = await requestQbTokens({ grant_type: "authorization_code", code, redirect_uri: qbConfig().redirectUri ?? "" });
  if (res.status !== 200) {
    console.error(`QuickBooks token error: ${await res.text()}`);
    return back("qb_error=token_failed");
  }
  const tokens = (await res.json()) as QbTokens;

  const values = { realmId, accessToken: tokens.access_token, refreshToken: tokens.refresh_token, updatedAt: new Date() };
  await getDb()
    .insert(quickbooksConnections)
    .values({ userId: state.sub, ...values })
    .onConflictDoUpdate({ target: quickbooksConnections.userId, set: values });

  return back("qb_success=true");
});
