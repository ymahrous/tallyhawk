import "server-only";
import { Resend } from "resend";
import { RETENTION, period } from "@/lib/retention";

function resetEmailHtml(resetUrl: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #111;">Reset your password</h2>
      <p style="color: #555; font-size: 16px; line-height: 1.5;">
        We received a request to reset your password for your Tallyhawk account.
        Click the button below to choose a new one:
      </p>
      <div style="margin: 30px 0;">
        <a href="${resetUrl}" style="background-color: #000; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
          Reset Password
        </a>
      </div>
      <p style="color: #888; font-size: 14px;">
        If you didn't request this, you can safely ignore this email. This link expires in ${period(RETENTION.resetLinkMinutes, "minute")} and works once.
      </p>
    </div>`;
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");
  const { error } = await new Resend(apiKey).emails.send({
    from: process.env.MAIL_FROM || "Tallyhawk <onboarding@resend.dev>",
    to: [to],
    subject: "Reset your Tallyhawk password",
    html: resetEmailHtml(resetUrl),
  });
  if (error) throw new Error(error.message);
}
