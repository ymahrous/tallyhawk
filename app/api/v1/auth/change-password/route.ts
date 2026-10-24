import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { hashPassword, newPassword, verifyPassword } from "@/server/auth";
import { issueSession } from "@/server/accounts";
import { getDb } from "@/server/db";
import { users } from "@/server/db/schema";
import { ApiError, getCurrentAccount, json, parseJson, route } from "@/server/http";
import { LIMITS, rateLimit } from "@/server/rate-limit";

const Body = z.object({ current_password: z.string().max(1024), new_password: newPassword });

// Customers and admins alike. Changing the password signs out every other session; this one gets a
// fresh token in the response so the person who changed it stays signed in.
export const POST = route(async (request) => {
  const account = await getCurrentAccount(request);
  const body = await parseJson(request, Body);
  await rateLimit("change-password", account.id, LIMITS.changePasswordPerAccount);
  if (!(await verifyPassword(body.current_password, account.hashedPassword))) {
    throw new ApiError(400, "Current password is incorrect.");
  }
  const [updated] = await getDb()
    .update(users)
    .set({ hashedPassword: await hashPassword(body.new_password), tokenVersion: sql`${users.tokenVersion} + 1` })
    .where(eq(users.id, account.id))
    .returning();
  return json({ message: "Password updated successfully.", ...(await issueSession(updated)) });
});
