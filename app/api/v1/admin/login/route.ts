import { eq } from "drizzle-orm";
import { z } from "zod";
import { createAccessToken, verifyPassword } from "@/server/auth";
import { getDb } from "@/server/db";
import { users } from "@/server/db/schema";
import { ApiError, json, parseJson, route } from "@/server/http";

// There is intentionally no admin signup. The admin is a single manually-seeded row in the user
// table whose username is ADMIN_USERNAME; only that account can obtain an admin (role) token.

const Body = z.object({ username: z.string(), password: z.string() });

export const POST = route(async (request) => {
  const { username, password } = await parseJson(request, Body);
  const adminUsername = process.env.ADMIN_USERNAME;
  if (!adminUsername || username !== adminUsername) throw new ApiError(401, "Invalid credentials");

  const [user] = await getDb().select().from(users).where(eq(users.username, adminUsername)).limit(1);
  if (!user || !(await verifyPassword(password, user.hashedPassword))) throw new ApiError(401, "Invalid credentials");

  const token = await createAccessToken({ sub: user.username, role: "admin" }, 12 * 60 * 60);
  return json({ access_token: token, token_type: "bearer" });
});
