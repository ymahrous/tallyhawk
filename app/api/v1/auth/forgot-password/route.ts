import { eq } from "drizzle-orm";
import { z } from "zod";
import { generatePasswordResetToken } from "@/server/auth";
import { getDb } from "@/server/db";
import { passwordResetTokens, users } from "@/server/db/schema";
import { sendPasswordResetEmail } from "@/server/email";
import { appUrl, json, parseJson, route } from "@/server/http";

const Body = z.object({ email: z.string() });

// Always the same answer, so the endpoint can't be used to discover which emails have accounts.
const SUCCESS = { message: "If an account with that email exists, a reset link has been sent." };

export const POST = route(async (request) => {
  const { email } = await parseJson(request, Body);
  const db = getDb();

  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.username, email)).limit(1);
  if (!user) return json(SUCCESS);

  const token = generatePasswordResetToken();
  await db.insert(passwordResetTokens).values({ userId: user.id, token });

  const resetUrl = `${appUrl(request)}/reset-password?token=${token}`;
  try {
    await sendPasswordResetEmail(email, resetUrl);
  } catch (error) {
    // Logged, never surfaced — the response must not reveal whether the account exists.
    console.error(JSON.stringify({ level: "error", event: "reset_email_failed", error: String(error) }));
  }
  if (process.env.NODE_ENV !== "production") console.info(`Password reset link for ${email}: ${resetUrl}`);

  return json(SUCCESS);
});
