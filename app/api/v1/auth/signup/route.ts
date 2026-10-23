import { eq } from "drizzle-orm";
import { z } from "zod";
import { createAccessToken, hashPassword } from "@/server/auth";
import { getDb } from "@/server/db";
import { users } from "@/server/db/schema";
import { ApiError, json, parseJson, route } from "@/server/http";

const Body = z.object({ username: z.string(), password: z.string() });

export const POST = route(async (request) => {
  const { username, password } = await parseJson(request, Body);
  const db = getDb();

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
  if (existing) throw new ApiError(400, "Email already registered");

  const [user] = await db
    .insert(users)
    .values({ username, hashedPassword: await hashPassword(password) })
    .onConflictDoNothing({ target: users.username })
    .returning();
  if (!user) throw new ApiError(400, "Email already registered");

  const token = await createAccessToken({ sub: user.username });
  return json({ access_token: token, token_type: "bearer" }, { status: 201 });
});
