import { loginFields } from "@/server/auth";
import { authenticate, issueSession } from "@/server/accounts";
import { getDb } from "@/server/db";
import { json, parseJson, route } from "@/server/http";

// One sign-in for both account types. The response's `role` tells the client where to go: admins
// get a (shorter) admin session for the admin dashboard, customers a customer session for the app.
export const POST = route(async (request) => {
  const { username, password } = await parseJson(request, loginFields);
  const account = await authenticate(getDb(), request, username, password);
  return json(await issueSession(account));
});
