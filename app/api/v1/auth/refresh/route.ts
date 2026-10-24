import { issueSession } from "@/server/accounts";
import { getCurrentAccount, json, route } from "@/server/http";

/**
 * Re-issues the session token with the account's current claims, e.g. after an upgrade so the
 * token's `plan` matches the database without signing out. Revoked or expired sessions get 401.
 */
export const POST = route(async (request) => json(await issueSession(await getCurrentAccount(request))));
