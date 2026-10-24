import { sql } from "drizzle-orm";
import { z } from "zod";
import { emailAddress, hashPassword, newPassword } from "@/server/auth";
import { issueSession } from "@/server/accounts";
import { getDb } from "@/server/db";
import { users } from "@/server/db/schema";
import { ApiError, clientIp, json, parseJson, route } from "@/server/http";
import { LIMITS, rateLimit } from "@/server/rate-limit";

const Body = z.object({ username: emailAddress, password: newPassword });

// Always creates a customer account; admin accounts can only be created by another admin.
export const POST = route(async (request) => {
  const { username, password } = await parseJson(request, Body);
  await rateLimit("signup-ip", clientIp(request), LIMITS.signupPerIp);
  const db = getDb();

  const [existing] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.username}) = ${username}`).limit(1);
  if (existing) throw new ApiError(400, "Email already registered");

  const [user] = await db
    .insert(users)
    .values({ username, hashedPassword: await hashPassword(password), role: "user", lastLoginAt: new Date() })
    .onConflictDoNothing({ target: users.username })
    .returning();
  if (!user) throw new ApiError(400, "Email already registered");

  // Same body as /auth/login, so the client can seed the plan from either token.
  return json(await issueSession(user), { status: 201 });
});
