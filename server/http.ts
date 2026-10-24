import "server-only";
import { eq } from "drizzle-orm";
import type { z } from "zod";
import { decodeAccessToken } from "./auth";
import { getDb } from "./db";
import { users, type User } from "./db/schema";

// Error and response conventions are kept identical to the FastAPI backend the frontend was built
// against: errors are `{ "detail": ... }`, validation failures are 422 with a list of issues.

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly detail: unknown,
    readonly headers?: Record<string, string>
  ) {
    super(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
}

export function json(body: unknown, init: ResponseInit = {}): Response {
  return Response.json(body, init);
}

export function noContent(): Response {
  return new Response(null, { status: 204 });
}

/** Route context for dynamic segments, e.g. `Params<"documentId">`. */
export interface Params<K extends string> {
  params: Promise<Record<K, string>>;
}

type Handler<C> = (request: Request, context: C) => Promise<Response>;

/** Wraps a route handler so thrown ApiErrors become JSON responses and anything else a logged 500. */
export function route<C = unknown>(handler: Handler<C>): Handler<C> {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      if (error instanceof ApiError) return json({ detail: error.detail }, { status: error.status, headers: error.headers });
      console.error(JSON.stringify({ level: "error", path: new URL(request.url).pathname, error: String(error) }));
      return json({ detail: "Internal Server Error" }, { status: 500 });
    }
  };
}

function validationError(issues: z.core.$ZodIssue[]): ApiError {
  return new ApiError(
    422,
    issues.map((issue) => ({ loc: ["body", ...issue.path.map(String)], msg: issue.message, type: issue.code }))
  );
}

/** No JSON body this API accepts comes anywhere near this; larger ones are refused unread. */
export const MAX_JSON_BYTES = 64 * 1024;

/** Parses and validates a JSON body (FastAPI/Pydantic equivalent). */
export async function parseJson<S extends z.ZodType>(request: Request, schema: S): Promise<z.infer<S>> {
  const tooLarge = () => new ApiError(413, "Request body too large.");
  if (Number(request.headers.get("content-length") ?? 0) > MAX_JSON_BYTES) throw tooLarge();
  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_JSON_BYTES) throw tooLarge();
    body = JSON.parse(text);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(422, [{ loc: ["body"], msg: "Invalid JSON body", type: "json_invalid" }]);
  }
  const result = schema.safeParse(body);
  if (!result.success) throw validationError(result.error.issues);
  return result.data;
}

interface IntQueryOptions {
  required?: boolean;
  min?: number;
  max?: number;
  fallback?: number;
}

/** Reads an integer query parameter with FastAPI-style 422s for missing/invalid/out-of-range values. */
export function intQuery(url: URL, name: string, options: IntQueryOptions = {}): number | undefined {
  const raw = url.searchParams.get(name);
  const fail = (msg: string) => new ApiError(422, [{ loc: ["query", name], msg, type: "value_error" }]);
  if (raw === null || raw === "") {
    if (options.required) throw fail("Field required");
    return options.fallback;
  }
  if (!/^-?\d+$/.test(raw.trim())) throw fail("Input should be a valid integer");
  const value = Number(raw);
  if (options.min !== undefined && value < options.min) throw fail(`Input should be >= ${options.min}`);
  if (options.max !== undefined && value > options.max) throw fail(`Input should be <= ${options.max}`);
  return value;
}

function bearerToken(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) throw new ApiError(401, "Not authenticated");
  return token;
}

/**
 * Resolves the account (customer or admin) behind the Bearer session token, or throws 401. Every
 * check is made against the database, not just the token, so revoking sessions, suspending an
 * account or changing its role takes effect on the very next request.
 */
export async function getCurrentAccount(request: Request): Promise<User> {
  const payload = await decodeAccessToken(bearerToken(request));
  if (!payload || payload.role === "qb_oauth") throw new ApiError(401, "Invalid token");
  if (!payload.sub) throw new ApiError(401, "Invalid token payload");

  const [account] = await getDb().select().from(users).where(eq(users.username, payload.sub)).limit(1);
  if (!account) throw new ApiError(401, "User not found");
  // Tokens issued before token versions existed (including the Python backend's) carry no `ver`,
  // which matches an account whose sessions have never been revoked.
  if ((payload.ver ?? 0) !== account.tokenVersion) throw new ApiError(401, "Session expired. Please log in again.");
  if (account.status !== "active") throw new ApiError(401, "This account has been suspended.");
  // A token is only good for the account type it was issued to.
  if ((payload.role === "admin") !== (account.role === "admin")) throw new ApiError(401, "Invalid token");
  return account;
}

/** Customer routes: the signed-in customer, or 401. Admin sessions get 403; admins aren't customers. */
export async function getCurrentUser(request: Request): Promise<User> {
  const account = await getCurrentAccount(request);
  if (account.role !== "user") throw new ApiError(403, "Admin accounts can't use customer features.");
  return account;
}

/** Admin routes: the signed-in admin, or 401 without a valid session and 403 for a customer's. */
export async function getCurrentAdmin(request: Request): Promise<User> {
  const account = await getCurrentAccount(request);
  if (account.role !== "admin") throw new ApiError(403, "Admin access required.");
  return account;
}

/** The signed-in customer when a valid session accompanies the request, else null. Never throws. */
export async function getOptionalUser(request: Request): Promise<User | null> {
  if (!request.headers.get("authorization")) return null;
  try {
    return await getCurrentUser(request);
  } catch {
    return null;
  }
}

/**
 * The client's IP address, for rate limiting and the audit log. On Vercel these headers are set by
 * the platform and can't be spoofed; behind another proxy, make sure it overwrites them.
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return request.headers.get("x-real-ip")?.trim() || forwarded || "unknown";
}

export function requirePro(user: User, message: string) {
  if (user.plan !== "pro") throw new ApiError(403, message);
}

/**
 * Public origin of the app, used in emails and redirects. Frontend and API now share an origin, so
 * the request's own origin is right by default; APP_URL (or the legacy FRONTEND_URL) overrides it.
 */
export function appUrl(request: Request): string {
  return (process.env.APP_URL || process.env.FRONTEND_URL || new URL(request.url).origin).replace(/\/$/, "");
}
