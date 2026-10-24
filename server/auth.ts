import "server-only";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { z } from "zod";
import { validateEmail, validatePassword } from "@/lib/validation";
import type { User } from "./db/schema";

// Same primitives as the former Python backend (bcrypt hashes, HS256 JWTs signed with SECRET_KEY),
// so existing password hashes and still-valid tokens keep working after the move.

const ALGORITHM = "HS256";
const DEFAULT_TTL_SECONDS = 24 * 60 * 60;
/** Admin sessions are shorter-lived than customer ones. */
export const ADMIN_TTL_SECONDS = 12 * 60 * 60;

function secret(): Uint8Array {
  const key = process.env.SECRET_KEY;
  if (!key) throw new Error("SECRET_KEY is not set");
  return new TextEncoder().encode(key);
}

export function verifyPassword(plain: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plain, hashed);
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, Number(process.env.BCRYPT_ROUNDS) || 12);
}

let dummyHash: Promise<string> | undefined;

/**
 * Checks a login attempt. When there's no such account it still runs one bcrypt comparison (against
 * a throwaway hash of the same cost), so response time doesn't reveal which emails are registered.
 */
export async function checkCredentials(account: { hashedPassword: string } | undefined, plain: string): Promise<boolean> {
  if (account) return verifyPassword(plain, account.hashedPassword);
  dummyHash ??= hashPassword(randomBytes(16).toString("hex"));
  await verifyPassword(plain, await dummyHash);
  return false;
}

/** Turns one of lib/validation's "message or empty string" checks into a zod refinement. */
function check(validate: (value: string) => string) {
  return (value: string, ctx: z.RefinementCtx) => {
    const message = validate(value);
    if (message) ctx.addIssue({ code: "custom", message });
  };
}

/** A password being set (signup, change, reset): the same policy the forms enforce. */
export const newPassword = z.string().superRefine(check(validatePassword));

/** A new account's username: the email address password-reset links are sent to, stored lowercase. */
export const emailAddress = z
  .string()
  .trim()
  .superRefine(check(validateEmail))
  .transform((value) => value.toLowerCase());

/** A login attempt's fields: bounded so oversized input can't be used to burn CPU in bcrypt. */
export const loginFields = z.object({ username: z.string().trim().max(254), password: z.string().max(1024) });

export interface TokenClaims {
  sub: string;
  plan?: string;
  /** "user" or "admin" for sessions; "qb_oauth" for QuickBooks OAuth state (never a session). */
  role?: string;
  /** The account's token_version when the token was issued; a mismatch means it was revoked. */
  ver?: number;
}

export function createAccessToken(claims: TokenClaims, ttlSeconds = DEFAULT_TTL_SECONDS): Promise<string> {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: ALGORITHM, typ: "JWT" })
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSeconds)
    .sign(secret());
}

/**
 * A session token for this account. Customers carry their plan (it seeds the UI before the API
 * answers); admins get a shorter session and no plan. Both carry the role and token version, which
 * server/http.ts checks against the database on every request.
 */
export function createSessionToken(account: Pick<User, "username" | "plan" | "role" | "tokenVersion">): Promise<string> {
  return account.role === "admin"
    ? createAccessToken({ sub: account.username, role: "admin", ver: account.tokenVersion }, ADMIN_TTL_SECONDS)
    : createAccessToken({ sub: account.username, plan: account.plan, role: "user", ver: account.tokenVersion });
}

/** Returns the verified payload, or null for a bad signature, expired token or malformed input. */
export async function decodeAccessToken(token: string): Promise<(JWTPayload & Partial<TokenClaims>) | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: [ALGORITHM] });
    return payload as JWTPayload & Partial<TokenClaims>;
  } catch {
    return null;
  }
}

/** URL-safe random token, equivalent to Python's secrets.token_urlsafe(32). */
export function generatePasswordResetToken(): string {
  return randomBytes(32).toString("base64url");
}

/** What's stored for a password-reset token: a database leak must not yield usable reset links. */
export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
