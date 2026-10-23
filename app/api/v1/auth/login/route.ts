import { eq } from "drizzle-orm";
import { z } from "zod";
import { createAccessToken, verifyPassword } from "@/server/auth";
import { getDb } from "@/server/db";
import { users } from "@/server/db/schema";
import { ApiError, json, parseJson, route } from "@/server/http";

const Body = z.object({ username: z.string(), password: z.string() });

export const POST = route(async (request) => {
  const { username, password } = await parseJson(request, Body);
  const [user] = await getDb().select().from(users).where(eq(users.username, username)).limit(1);
  if (!user || !(await verifyPassword(password, user.hashedPassword))) throw new ApiError(401, "Invalid credentials");

  const token = await createAccessToken({ sub: user.username, plan: user.plan });
  return json({ access_token: token, token_type: "bearer" });
});
