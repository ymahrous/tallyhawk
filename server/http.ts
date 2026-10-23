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
    readonly detail: unknown
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
      if (error instanceof ApiError) return json({ detail: error.detail }, { status: error.status });
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

/** Parses and validates a JSON body (FastAPI/Pydantic equivalent). */
export async function parseJson<S extends z.ZodType>(request: Request, schema: S): Promise<z.infer<S>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
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

/** Resolves the signed-in user from the Bearer JWT, or throws 401. */
export async function getCurrentUser(request: Request): Promise<User> {
  const payload = await decodeAccessToken(bearerToken(request));
  if (!payload || payload.role === "qb_oauth") throw new ApiError(401, "Invalid token");
  if (!payload.sub) throw new ApiError(401, "Invalid token payload");

  const [user] = await getDb().select().from(users).where(eq(users.username, payload.sub)).limit(1);
  if (!user) throw new ApiError(401, "User not found");
  return user;
}

/** Admin routes accept only tokens minted by POST /admin/login (role: "admin"). */
export async function getCurrentAdmin(request: Request): Promise<string> {
  const payload = await decodeAccessToken(bearerToken(request));
  if (!payload || payload.role !== "admin") throw new ApiError(401, "Invalid or expired admin session");
  return payload.sub ?? "admin";
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
