// @vitest-environment node
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createAccessToken } from "@/server/auth";
import type { Db } from "@/server/db";
import { documents, quickbooksConnections } from "@/server/db/schema";
import { call, createDocument, createTestDb, createUser, resetTestDb, stubFetch } from "@/test/server";
import { GET as callback } from "./callback/route";
import { GET as connect } from "./connect/route";
import { DELETE as disconnect } from "./disconnect/route";
import { GET as status } from "./status/route";
import { GET as syncStatus } from "./sync-status/[documentId]/route";
import { POST as sync } from "./sync/[documentId]/route";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
});
beforeEach(async () => {
  await resetTestDb(db);
  vi.stubEnv("QB_CLIENT_ID", "client");
  vi.stubEnv("QB_CLIENT_SECRET", "secret");
  vi.stubEnv("QB_REDIRECT_URI", "http://localhost:3000/api/v1/quickbooks/callback");
  vi.stubEnv("QB_ENVIRONMENT", "sandbox");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

async function connected(plan = "pro") {
  const fixture = await createUser(db, { plan });
  await db.insert(quickbooksConnections).values({ userId: fixture.user.id, realmId: "realm1", accessToken: "old-access", refreshToken: "refresh" });
  return fixture;
}

describe("OAuth", () => {
  it("builds the Intuit authorization URL with a signed state", async () => {
    const { token } = await createUser(db);
    const url = new URL((await call(connect, "GET", "/quickbooks/connect", { token })).json.url);
    expect(url.origin + url.pathname).toBe("https://appcenter.intuit.com/connect/oauth2");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: "client",
      scope: "com.intuit.quickbooks.accounting",
      redirect_uri: "http://localhost:3000/api/v1/quickbooks/callback",
      response_type: "code",
    });
    expect(url.searchParams.get("state")!.split(".")).toHaveLength(3);
  });

  it("500s when not configured", async () => {
    vi.stubEnv("QB_CLIENT_ID", "");
    const { token } = await createUser(db);
    expect((await call(connect, "GET", "/quickbooks/connect", { token })).status).toBe(500);
  });

  it("exchanges the code and stores tokens, then redirects to the account page", async () => {
    const { user } = await createUser(db);
    const state = await createAccessToken({ sub: user.id, role: "qb_oauth" });
    const fetchMock = stubFetch(() => Response.json({ access_token: "a1", refresh_token: "r1" }));

    const res = await call(callback, "GET", `/quickbooks/callback?code=abc&state=${state}&realmId=realm9`);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("http://localhost:3000/account?qb_success=true");
    const init = fetchMock.mock.calls[0][1]!;
    expect(init.headers).toMatchObject({ Authorization: `Basic ${Buffer.from("client:secret").toString("base64")}` });
    expect(String(init.body)).toContain("grant_type=authorization_code");
    expect((await db.select().from(quickbooksConnections))[0]).toMatchObject({ userId: user.id, realmId: "realm9", accessToken: "a1", refreshToken: "r1" });
  });

  it("rejects forged state, missing realm and token failures", async () => {
    const { user } = await createUser(db);
    const state = await createAccessToken({ sub: user.id, role: "qb_oauth" });
    const loc = async (q: string) => (await call(callback, "GET", `/quickbooks/callback?${q}`)).headers.get("location");

    expect(await loc(`code=abc&state=${user.id}&realmId=r`)).toBe("http://localhost:3000/account?qb_error=invalid_state");
    expect(await loc(`code=abc&state=${state}`)).toBe("http://localhost:3000/account?qb_error=missing_realm");
    stubFetch(() => new Response("bad code", { status: 400 }));
    expect(await loc(`code=abc&state=${state}&realmId=r`)).toBe("http://localhost:3000/account?qb_error=token_failed");
    expect(await db.select().from(quickbooksConnections)).toEqual([]);
  });

  it("reports and removes the connection", async () => {
    const { token } = await connected();
    expect((await call(status, "GET", "/quickbooks/status", { token })).json).toEqual({ connected: true });
    expect((await call(disconnect, "DELETE", "/quickbooks/disconnect", { token })).status).toBe(200);
    expect((await call(status, "GET", "/quickbooks/status", { token })).json).toEqual({ connected: false });
    expect((await call(disconnect, "DELETE", "/quickbooks/disconnect", { token })).status).toBe(404);
  });
});

describe("sync", () => {
  it("posts a Purchase in the base currency, refreshing an expired token once", async () => {
    const { user, token } = await connected();
    const { doc } = await createDocument(db, {
      ownerId: user.id,
      extraction: { extractedData: { vendor: "Delta", date: "March 5, 2026", category: "Travel", payment: "VISA ****1234" }, convertedAmount: 320.5, convertedCurrency: "USD" },
    });
    const calls: { url: string; init?: RequestInit }[] = [];
    stubFetch((url, init) => {
      calls.push({ url, init });
      if (url.includes("/oauth2/v1/tokens/bearer")) return Response.json({ access_token: "new-access", refresh_token: "new-refresh" });
      const auth = (init?.headers as Record<string, string>).Authorization;
      return auth === "Bearer old-access" ? new Response("expired", { status: 401 }) : Response.json({ Purchase: {} });
    });

    const res = await call(sync, "POST", `/quickbooks/sync/${doc.id}`, { token, params: { documentId: doc.id } });
    expect(res.json).toEqual({ message: "Synced to QuickBooks successfully!" });
    expect(calls.map((c) => c.url)).toEqual([
      "https://sandbox-quickbooks.api.intuit.com/v3/company/realm1/purchase?minorversion=65",
      "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
      "https://sandbox-quickbooks.api.intuit.com/v3/company/realm1/purchase?minorversion=65",
    ]);
    expect(JSON.parse(String(calls[2].init!.body))).toEqual({
      PaymentType: "CreditCard",
      CurrencyRef: { value: "USD" },
      AccountRef: { value: "41", name: "Opening Balance Equity" },
      TotalAmt: 320.5,
      PrivateNote: `edocAI-${doc.id}`,
      Line: [{ Id: "1", Amount: 320.5, DetailType: "AccountBasedExpenseLineDetail", AccountBasedExpenseLineDetail: { AccountRef: { value: "13", name: "Travel" } } }],
      TxnDate: "2026-03-05",
    });
    expect((await db.select().from(documents))[0].quickbooksSynced).toBe(true);
    expect((await db.select().from(quickbooksConnections))[0].accessToken).toBe("new-access");
  });

  it("falls back to the raw amount in its own currency for stale conversions", async () => {
    const { user, token } = await connected();
    const { doc } = await createDocument(db, { ownerId: user.id, extraction: { extractedData: { total_amount: "€40,00" }, originalCurrency: "EUR", convertedAmount: 44, convertedCurrency: "GBP" } });
    const fetchMock = stubFetch(() => Response.json({}));
    await call(sync, "POST", `/quickbooks/sync/${doc.id}`, { token, params: { documentId: doc.id } });
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]!.body));
    expect(body).toMatchObject({ PaymentType: "Cash", CurrencyRef: { value: "EUR" }, TotalAmt: 4000 });
    expect(body.TxnDate).toBeUndefined();
  });

  it("disconnects when the refresh token is rejected", async () => {
    const { user, token } = await connected();
    const { doc } = await createDocument(db, { ownerId: user.id });
    stubFetch(() => new Response("nope", { status: 401 }));
    const res = await call(sync, "POST", `/quickbooks/sync/${doc.id}`, { token, params: { documentId: doc.id } });
    expect(res).toMatchObject({ status: 401, json: { detail: "QuickBooks connection expired. Please reconnect." } });
    expect(await db.select().from(quickbooksConnections)).toEqual([]);
  });

  it("surfaces QuickBooks faults", async () => {
    const { user, token } = await connected();
    const { doc } = await createDocument(db, { ownerId: user.id });
    stubFetch(() => Response.json({ Fault: { Error: [{ Message: "Invalid account" }] } }, { status: 400 }));
    const res = await call(sync, "POST", `/quickbooks/sync/${doc.id}`, { token, params: { documentId: doc.id } });
    expect(res).toMatchObject({ status: 500, json: { detail: "QuickBooks Error: Invalid account" } });
    expect((await db.select().from(documents).where(eq(documents.id, doc.id)))[0].quickbooksSynced).toBe(false);
  });

  it("guards plan, ownership, readiness and connection", async () => {
    const free = await connected("free");
    const pro = await createUser(db, { username: "pro@test.com", plan: "pro" });
    const ready = await createDocument(db, { ownerId: pro.user.id });
    const pending = await createDocument(db, { ownerId: pro.user.id, status: "PENDING", extraction: null });
    const theirs = await createDocument(db, { ownerId: free.user.id });
    const run = (token: string, id: string) => call(sync, "POST", `/quickbooks/sync/${id}`, { token, params: { documentId: id } });

    expect((await run(free.token, theirs.doc.id)).status).toBe(403);
    expect((await run(pro.token, theirs.doc.id)).status).toBe(404);
    expect((await run(pro.token, pending.doc.id)).json.detail).toBe("Extraction not ready.");
    expect((await run(pro.token, ready.doc.id)).json.detail).toBe("QuickBooks not connected. Please connect in settings.");
  });
});

describe("sync status", () => {
  it("queries QuickBooks for the tagged purchase", async () => {
    const { token } = await connected();
    const fetchMock = stubFetch(() => Response.json({ QueryResponse: { Purchase: [{ Id: "1" }] } }));
    expect((await call(syncStatus, "GET", "/quickbooks/sync-status/d1", { token, params: { documentId: "d1" } })).json).toEqual({ synced: true });
    expect(decodeURIComponent(fetchMock.mock.calls[0][0] as string)).toContain("select * from Purchase where PrivateNote = 'edocAI-d1'");

    stubFetch(() => Response.json({ QueryResponse: {} }));
    expect((await call(syncStatus, "GET", "/quickbooks/sync-status/d1", { token, params: { documentId: "d1" } })).json).toEqual({ synced: false });
    stubFetch(() => new Response("err", { status: 500 }));
    expect((await call(syncStatus, "GET", "/quickbooks/sync-status/d1", { token, params: { documentId: "d1" } })).json).toEqual({ synced: false });
  });

  it("is false for free users and when not connected", async () => {
    const free = await connected("free");
    const pro = await createUser(db, { username: "pro@test.com", plan: "pro" });
    for (const token of [free.token, pro.token]) {
      expect((await call(syncStatus, "GET", "/quickbooks/sync-status/d1", { token, params: { documentId: "d1" } })).json).toEqual({ synced: false });
    }
  });
});
