import type { TokenPayload } from "@/lib/api";

/** Unsigned JWT in the shape lib/api.ts decodes (it never verifies signatures client-side). */
export function makeToken(payload: Partial<TokenPayload> = {}): string {
  const now = Math.floor(Date.now() / 1000);
  const body = { sub: "ada@example.com", exp: now + 3600, iat: now - 60, plan: "free", ...payload };
  const encode = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/, "");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(body)}.signature`;
}

export function signIn(payload: Partial<TokenPayload> = {}): string {
  const token = makeToken(payload);
  localStorage.setItem("token", token);
  return token;
}

export function signInExpired(): string {
  return signIn({ exp: Math.floor(Date.now() / 1000) - 60 });
}
