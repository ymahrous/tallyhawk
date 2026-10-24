import { z } from "zod";
import { findAccountByUsername, sendPasswordReset } from "@/server/accounts";
import { getDb } from "@/server/db";
import { clientIp, json, parseJson, route } from "@/server/http";
import { LIMITS, rateLimit } from "@/server/rate-limit";

const Body = z.object({ email: z.string().trim().max(254) });

// Always the same answer (and the same limits), so the endpoint can't be used to discover which
// emails have accounts.
const SUCCESS = { message: "If an account with that email exists, a reset link has been sent." };

export const POST = route(async (request) => {
  const { email } = await parseJson(request, Body);
  await rateLimit("reset-ip", clientIp(request), LIMITS.passwordResetPerIp);
  await rateLimit("reset-email", email, LIMITS.passwordResetPerEmail);

  const db = getDb();
  const account = email ? await findAccountByUsername(db, email) : undefined;
  if (account) await sendPasswordReset(db, request, account);
  return json(SUCCESS);
});
