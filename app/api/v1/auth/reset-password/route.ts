import { eq } from "drizzle-orm";
import { z } from "zod";
import { hashPassword } from "@/server/auth";
import { getDb } from "@/server/db";
import { passwordResetTokens, users } from "@/server/db/schema";
import { ApiError, json, parseJson, route } from "@/server/http";

const Body = z.object({ token: z.string(), new_password: z.string() });

export const POST = route(async (request) => {
  const body = await parseJson(request, Body);
  const db = getDb();

  const [token] = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.token, body.token)).limit(1);
  if (!token) throw new ApiError(400, "Invalid or expired token.");
  if (token.used) throw new ApiError(400, "Token has already been used.");
  if (token.expiresAt.getTime() < Date.now()) throw new ApiError(400, "Token has expired.");

  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, token.userId)).limit(1);
  if (!user) throw new ApiError(404, "User not found.");

  const hashed = await hashPassword(body.new_password);
  await db.transaction(async (tx) => {
    await tx.update(users).set({ hashedPassword: hashed }).where(eq(users.id, user.id));
    await tx.update(passwordResetTokens).set({ used: true }).where(eq(passwordResetTokens.id, token.id));
  });

  return json({ message: "Password updated successfully." });
});
