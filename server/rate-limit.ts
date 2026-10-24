import "server-only";
import { createHmac } from "node:crypto";
import { lt, sql } from "drizzle-orm";
import { getDb } from "./db";
import { rateLimits } from "./db/schema";
import { ApiError } from "./http";

// Fixed-window counters in Postgres, so the limits hold across every serverless instance without
// another service. Identifiers (IP addresses, emails) are stored only as keyed hashes.

export interface Limit {
  limit: number;
  windowSeconds: number;
}

const MINUTE = 60;
const HOUR = 60 * MINUTE;

/** Every limit in one place. Generous enough for people, tight enough to stop scripted abuse. */
export const LIMITS = {
  loginPerIp: { limit: 30, windowSeconds: 15 * MINUTE },
  // Keyed by the attempted username whether or not the account exists, so the lockout can't be
  // used to discover which emails are registered.
  loginPerAccount: { limit: 10, windowSeconds: 15 * MINUTE },
  signupPerIp: { limit: 10, windowSeconds: HOUR },
  passwordResetPerIp: { limit: 10, windowSeconds: HOUR },
  passwordResetPerEmail: { limit: 3, windowSeconds: HOUR },
  resetAttemptPerIp: { limit: 20, windowSeconds: HOUR },
  changePasswordPerAccount: { limit: 10, windowSeconds: HOUR },
  feedbackPerIp: { limit: 10, windowSeconds: HOUR },
  contactPerIp: { limit: 5, windowSeconds: HOUR },
  uploadPerUser: { limit: 120, windowSeconds: HOUR },
  checkoutPerUser: { limit: 10, windowSeconds: HOUR },
} satisfies Record<string, Limit>;

/** Keyed hash (HMAC with SECRET_KEY): the IPv4 space is small enough to reverse a plain hash. */
export function hashIdentifier(value: string): string {
  return createHmac("sha256", process.env.SECRET_KEY ?? "").update(value.toLowerCase()).digest("hex").slice(0, 32);
}

/** Counts one hit for `identifier` in `bucket`; throws 429 (with Retry-After) once it's over the limit. */
export async function rateLimit(bucket: string, identifier: string, { limit, windowSeconds }: Limit): Promise<void> {
  const db = getDb();
  const key = `${bucket}:${hashIdentifier(identifier)}`;
  const now = new Date();
  const expired = sql`${rateLimits.windowStart} <= ${new Date(now.getTime() - windowSeconds * 1000).toISOString()}::timestamptz`;

  const [row] = await db
    .insert(rateLimits)
    .values({ key, count: 1, windowStart: now })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`CASE WHEN ${expired} THEN 1 ELSE ${rateLimits.count} + 1 END`,
        windowStart: sql`CASE WHEN ${expired} THEN ${now.toISOString()}::timestamptz ELSE ${rateLimits.windowStart} END`,
      },
    })
    .returning({ count: rateLimits.count, windowStart: rateLimits.windowStart });

  // Occasionally sweep counters whose window ended long ago.
  if (Math.random() < 0.01) {
    await db.delete(rateLimits).where(lt(rateLimits.windowStart, new Date(now.getTime() - 24 * HOUR * 1000)));
  }

  if (row.count > limit) {
    const resetsAt = new Date(row.windowStart).getTime() + windowSeconds * 1000;
    const retryAfter = Math.max(1, Math.ceil((resetsAt - now.getTime()) / 1000));
    throw new ApiError(429, "Too many requests. Please try again later.", { "Retry-After": String(retryAfter) });
  }
}
