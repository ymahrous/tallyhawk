import { authenticate, issueSession } from "@/server/accounts";
import { loginFields } from "@/server/auth";
import { getDb } from "@/server/db";
import { ApiError, json, parseJson, route } from "@/server/http";

// Admin-only sign-in, kept for API clients. POST /auth/login also signs admins in. There is no admin
// signup: the first admin is created with `npm run admin:create`, and admins add others from the
// dashboard. A customer's correct password gets the same 401 as a wrong one.
export const POST = route(async (request) => {
  const { username, password } = await parseJson(request, loginFields);
  const account = await authenticate(getDb(), request, username, password);
  if (account.role !== "admin") throw new ApiError(401, "Invalid credentials");
  return json(await issueSession(account));
});
