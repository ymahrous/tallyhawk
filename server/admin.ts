import "server-only";
import { and, eq, ilike, or, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { z } from "zod";
import type { Db } from "./db";
import { users, type User } from "./db/schema";
import { ApiError, intQuery } from "./http";
import { TRIAGE_STATUSES } from "@/lib/support";

// Helpers shared by the /admin routes.

export interface Page {
  limit: number;
  offset: number;
}

/** `limit` (1–200, default 25) and `offset` (≥ 0) from the query string. */
export function pageOf(url: URL): Page {
  return {
    limit: intQuery(url, "limit", { min: 1, max: 200, fallback: 25 })!,
    offset: intQuery(url, "offset", { min: 0, fallback: 0 })!,
  };
}

/** A query-string filter restricted to known values: anything else is a 422, never passed to SQL. */
export function enumQuery<T extends string>(url: URL, name: string, allowed: readonly T[]): T | undefined {
  const raw = url.searchParams.get(name);
  if (raw === null || raw === "") return undefined;
  if (!(allowed as readonly string[]).includes(raw)) {
    throw new ApiError(422, [{ loc: ["query", name], msg: `Input should be one of: ${allowed.join(", ")}`, type: "enum" }]);
  }
  return raw as T;
}

/**
 * Case-insensitive "contains" across `columns` for the `search` query parameter. LIKE wildcards in
 * the input are escaped, so a search for "100%" means the text "100%".
 */
export function searchFilter(url: URL, columns: PgColumn[]): SQL | undefined {
  const term = url.searchParams.get("search")?.trim().slice(0, 200);
  if (!term) return undefined;
  const pattern = `%${term.replace(/[\\%_]/g, "\\$&")}%`;
  return or(...columns.map((column) => ilike(column, pattern)));
}

/** The customer with this id, or 404. Admin accounts are never returned here. */
export async function findCustomer(db: Db, id: string): Promise<User> {
  const [user] = await db.select().from(users).where(and(eq(users.id, id), eq(users.role, "user"))).limit(1);
  if (!user) throw new ApiError(404, "User not found.");
  return user;
}

/** The admin with this id, or 404. */
export async function findAdmin(db: Db, id: string): Promise<User> {
  const [admin] = await db.select().from(users).where(and(eq(users.id, id), eq(users.role, "admin"))).limit(1);
  if (!admin) throw new ApiError(404, "Admin not found.");
  return admin;
}

/** Body of PATCH requests on feedback and contact messages. */
export const TriageUpdate = z
  .object({
    status: z.enum(TRIAGE_STATUSES).optional(),
    admin_note: z.string().trim().max(2000).nullish(),
  })
  .refine((body) => body.status !== undefined || body.admin_note !== undefined, "Nothing to update.");

/** `{ total, limit, offset, results }`, the shape every admin list answers with. */
export function paged<T>(total: number, page: Page, results: T[]) {
  return { total, limit: page.limit, offset: page.offset, results };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** The last `days` UTC calendar days, oldest first, as YYYY-MM-DD. */
export function dayRange(days: number, now = new Date()): string[] {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Array.from({ length: days }, (_, i) => new Date(today - (days - 1 - i) * DAY_MS).toISOString().slice(0, 10));
}
