import "server-only";
import { eq } from "drizzle-orm";
import { parseInvoiceDate } from "./amounts";
import type { Db } from "./db";
import { quickbooksConnections } from "./db/schema";
import { ApiError } from "./http";

export const QB_AUTH_URL = "https://appcenter.intuit.com/connect/oauth2";
export const QB_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
export const QB_SCOPE = "com.intuit.quickbooks.accounting";

export function qbConfig() {
  return {
    clientId: process.env.QB_CLIENT_ID,
    clientSecret: process.env.QB_CLIENT_SECRET,
    redirectUri: process.env.QB_REDIRECT_URI,
    apiBaseUrl:
      (process.env.QB_ENVIRONMENT || "sandbox") === "sandbox"
        ? "https://sandbox-quickbooks.api.intuit.com"
        : "https://quickbooks.api.intuit.com",
  };
}

export interface QbTokens {
  access_token: string;
  refresh_token: string;
}

/** POSTs a grant to Intuit's token endpoint with client-credential Basic auth. */
export async function requestQbTokens(params: Record<string, string>): Promise<Response> {
  const { clientId, clientSecret } = qbConfig();
  return fetch(QB_TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams(params),
  });
}

type Connection = typeof quickbooksConnections.$inferSelect;

/**
 * Refreshes an expired access token. An invalid refresh token disconnects and throws 400 — not 401,
 * which the client (rightly) treats as "your Tallyhawk session expired" and signs the user out.
 */
export async function refreshQbToken(db: Db, conn: Connection): Promise<Connection> {
  const res = await requestQbTokens({ grant_type: "refresh_token", refresh_token: conn.refreshToken ?? "" });
  if (res.status !== 200) {
    await db.delete(quickbooksConnections).where(eq(quickbooksConnections.id, conn.id));
    throw new ApiError(400, "QuickBooks connection expired. Please reconnect.");
  }
  const tokens = (await res.json()) as QbTokens;
  const [updated] = await db
    .update(quickbooksConnections)
    .set({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token, updatedAt: new Date() })
    .where(eq(quickbooksConnections.id, conn.id))
    .returning();
  return updated;
}

/** Calls the QuickBooks API, refreshing the token once on a 401. */
export async function qbFetch(db: Db, conn: Connection, path: string, init: RequestInit = {}): Promise<Response> {
  const call = (token: string | null) =>
    fetch(`${qbConfig().apiBaseUrl}${path}`, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
  const res = await call(conn.accessToken);
  if (res.status !== 401) return res;
  const refreshed = await refreshQbToken(db, conn);
  return call(refreshed.accessToken);
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/**
 * YYYY-MM-DD for QuickBooks. Accepts every format the rest of the app understands (parseInvoiceDate)
 * plus "Month D, YYYY"; anything else (or an impossible date) is null, so QuickBooks uses today.
 */
export function toQbDate(raw: string): string | null {
  const parsed = parseInvoiceDate({ date: raw });
  if (parsed) return parsed.toISOString().slice(0, 10);
  const match = /^([A-Za-z]+) (\d{1,2}), (\d{4})$/.exec(raw.trim());
  if (!match) return null;
  const month = MONTHS.indexOf(match[1].toLowerCase());
  const day = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month, day));
  if (month < 0 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

/** Guesses a default QBO expense account from the category (standard sandbox account IDs). */
export function qbAccountFor(category: string): { value: string; name: string } {
  const c = category.toLowerCase();
  if (["travel", "airline", "hotel"].some((w) => c.includes(w))) return { value: "13", name: "Travel" };
  if (["meal", "food", "restaurant"].some((w) => c.includes(w))) return { value: "24", name: "Meals and Entertainment" };
  if (["software", "subscription", "saas"].some((w) => c.includes(w))) return { value: "56", name: "Software and Subscriptions" };
  if (["office", "equipment", "supplies"].some((w) => c.includes(w))) return { value: "28", name: "Office Supplies" };
  return { value: "41", name: "Opening Balance Equity" };
}
