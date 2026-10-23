import "server-only";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";

// Same primitives as the former Python backend (bcrypt hashes, HS256 JWTs signed with SECRET_KEY),
// so existing password hashes and still-valid tokens keep working after the move.

const ALGORITHM = "HS256";
const DEFAULT_TTL_SECONDS = 24 * 60 * 60;

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

export interface TokenClaims {
  sub: string;
  plan?: string;
  role?: string;
}

export function createAccessToken(claims: TokenClaims, ttlSeconds = DEFAULT_TTL_SECONDS): Promise<string> {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: ALGORITHM, typ: "JWT" })
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSeconds)
    .sign(secret());
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
