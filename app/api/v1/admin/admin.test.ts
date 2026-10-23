// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createAccessToken, decodeAccessToken } from "@/server/auth";
import type { Db } from "@/server/db";
import { feedback, subscriptions } from "@/server/db/schema";
import { call, createDocument, createTestDb, createUser, resetTestDb } from "@/test/server";
import { GET as timeseries } from "./documents/timeseries/route";
import { GET as listFeedback } from "./feedback/route";
import { POST as adminLogin } from "./login/route";
import { GET as overview } from "./overview/route";
import { GET as listUsers } from "./users/route";

let db: Db;
let adminToken: string;
beforeAll(async () => {
  db = await createTestDb();
  vi.stubEnv("ADMIN_USERNAME", "admin");
  vi.stubEnv("PRO_MONTHLY_PRICE_USD", "5");
});
afterAll(() => vi.unstubAllEnvs());
beforeEach(async () => {
  await resetTestDb(db);
  await createUser(db, { username: "admin", password: "admin-pass" });
  adminToken = await createAccessToken({ sub: "admin", role: "admin" });
});

describe("admin login", () => {
  it("only the designated account gets an admin token", async () => {
    const ok = await call(adminLogin, "POST", "/admin/login", { body: { username: "admin", password: "admin-pass" } });
    expect(ok.status).toBe(200);
    const claims = await decodeAccessToken(ok.json.access_token);
    expect(claims?.role).toBe("admin");
    expect(claims!.exp! - Date.now() / 1000).toBeLessThanOrEqual(12 * 3600);

    await createUser(db, { username: "ada@example.com", password: "pw" });
    expect((await call(adminLogin, "POST", "/admin/login", { body: { username: "ada@example.com", password: "pw" } })).status).toBe(401);
    expect((await call(adminLogin, "POST", "/admin/login", { body: { username: "admin", password: "wrong" } })).status).toBe(401);
  });

  it("rejects regular user tokens on admin routes", async () => {
    const { token } = await createUser(db, { username: "ada@example.com" });
    expect((await call(overview, "GET", "/admin/overview", { token })).status).toBe(401);
    expect((await call(overview, "GET", "/admin/overview")).status).toBe(401);
  });
});

describe("admin reports", () => {
  it("summarises users, documents, billing and integrations", async () => {
    const ada = await createUser(db, { username: "ada@example.com", plan: "pro" });
    await createDocument(db, { ownerId: ada.user.id, extraction: { confidenceScore: 0.9 } });
    await createDocument(db, { ownerId: ada.user.id, status: "FAILED", extraction: null });
    await db.insert(subscriptions).values({ userId: ada.user.id, status: "active" });
    await db.insert(feedback).values({ type: "Bug", message: "x" });

    const res = await call(overview, "GET", "/admin/overview", { token: adminToken });
    expect(res.json).toMatchObject({
      users: { total: 2, pro: 1, free: 1, signups_today: 2, signups_last_7d: 2, signups_last_30d: 2 },
      documents: { total: 2, by_status: { COMPLETED: 1, FAILED: 1 }, created_today: 2, created_last_7d: 2, flagged: 0, avg_confidence: 0.9 },
      billing: { active_subscriptions: 1, estimated_mrr_usd: 5, price_per_seat_usd: 5 },
      integrations: { quickbooks_connections: 0 },
      vendors: { total: 0 },
      feedback: { total: 1 },
    });
  });

  it("charts documents per day and validates the window", async () => {
    const { user } = await createUser(db, { username: "ada@example.com" });
    const today = new Date();
    await createDocument(db, { ownerId: user.id, createdAt: today });
    await createDocument(db, { ownerId: user.id, createdAt: today });
    await createDocument(db, { ownerId: user.id, createdAt: new Date(Date.now() - 100 * 86400_000) });

    const res = await call(timeseries, "GET", "/admin/documents/timeseries", { token: adminToken });
    expect(res.json).toEqual([{ date: today.toISOString().slice(0, 10), count: 2 }]);
    expect((await call(timeseries, "GET", "/admin/documents/timeseries?days=180", { token: adminToken })).json).toHaveLength(2);
    expect((await call(timeseries, "GET", "/admin/documents/timeseries?days=0", { token: adminToken })).status).toBe(422);
    expect((await call(timeseries, "GET", "/admin/documents/timeseries?days=181", { token: adminToken })).status).toBe(422);
  });

  it("pages users with document counts and filters by plan", async () => {
    const ada = await createUser(db, { username: "ada@example.com", plan: "pro" });
    await createDocument(db, { ownerId: ada.user.id });
    await createDocument(db, { ownerId: ada.user.id });

    const all = await call(listUsers, "GET", "/admin/users", { token: adminToken });
    expect(all.json).toMatchObject({ total: 2, limit: 25, offset: 0 });
    expect(all.json.results.find((u: { username: string }) => u.username === "ada@example.com").document_count).toBe(2);

    const pro = await call(listUsers, "GET", "/admin/users?plan=pro&limit=1", { token: adminToken });
    expect(pro.json.results).toHaveLength(1);
    expect(pro.json.results[0]).toMatchObject({ username: "ada@example.com", plan: "pro", document_count: 2 });
    expect((await call(listUsers, "GET", "/admin/users?limit=500", { token: adminToken })).status).toBe(422);
    expect((await call(listUsers, "GET", "/admin/users?offset=-1", { token: adminToken })).status).toBe(422);
  });

  it("lists feedback with the author when known", async () => {
    const ada = await createUser(db, { username: "ada@example.com" });
    await db.insert(feedback).values([
      { type: "Bug", message: "old", createdAt: new Date("2026-01-01T00:00:00Z") },
      { type: "Idea", message: "new", userId: ada.user.id, createdAt: new Date("2026-02-01T00:00:00Z") },
    ]);
    const res = await call(listFeedback, "GET", "/admin/feedback", { token: adminToken });
    expect(res.json.total).toBe(2);
    expect(res.json.results).toEqual([
      expect.objectContaining({ message: "new", username: "ada@example.com", created_at: "2026-02-01T00:00:00.000Z" }),
      expect.objectContaining({ message: "old", username: null }),
    ]);
  });
});
