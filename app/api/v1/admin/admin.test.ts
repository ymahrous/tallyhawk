// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { decodeAccessToken } from "@/server/auth";
import type { Db } from "@/server/db";
import { auditLog, contactMessages, documents, extractions, feedback, subscriptions, users } from "@/server/db/schema";
import { call, createAdmin, createDocument, createTestDb, createUser, flushBackground, resetTestDb } from "@/test/server";
import { GET as listAdmins, POST as createAdminRoute } from "./admins/route";
import { DELETE as deleteAdmin, PATCH as updateAdmin } from "./admins/[adminId]/route";
import { GET as analytics } from "./analytics/route";
import { GET as auditLogRoute } from "./audit-log/route";
import { GET as listContact } from "./contact/route";
import { DELETE as deleteContact, PATCH as updateContact } from "./contact/[messageId]/route";
import { GET as listDocuments } from "./documents/route";
import { POST as reprocess } from "./documents/[documentId]/reprocess/route";
import { GET as timeseries } from "./documents/timeseries/route";
import { GET as listFeedback } from "./feedback/route";
import { DELETE as deleteFeedback, PATCH as updateFeedback } from "./feedback/[feedbackId]/route";
import { POST as adminLogin } from "./login/route";
import { GET as me } from "./me/route";
import { GET as overview } from "./overview/route";
import { GET as listUsers } from "./users/route";
import { DELETE as deleteUser, GET as getUser, PATCH as updateUser } from "./users/[userId]/route";
import { POST as resetUserPassword } from "./users/[userId]/password-reset/route";
import { POST as signOutUser } from "./users/[userId]/sign-out/route";
import { GET as customerDocuments } from "../documents/route";

vi.mock("@/server/background", async () => (await import("@/test/server")).backgroundMock);
const storage = vi.hoisted(() => ({ deleteFromStorage: vi.fn(async () => {}), uploadToStorage: vi.fn() }));
vi.mock("@/server/storage", () => storage);
const email = vi.hoisted(() => ({ sendPasswordResetEmail: vi.fn(async () => {}) }));
vi.mock("@/server/email", () => email);
const stripeMock = vi.hoisted(() => ({ cancel: vi.fn(async () => ({})) }));
vi.mock("@/server/stripe", () => ({ stripe: () => ({ subscriptions: { cancel: stripeMock.cancel } }) }));
const pipeline = vi.hoisted(() => ({ processDocument: vi.fn(async () => ({ status: "success" })) }));
vi.mock("@/server/pipeline", () => pipeline);

let db: Db;
let admin: Awaited<ReturnType<typeof createAdmin>>;
beforeAll(async () => {
  db = await createTestDb();
  vi.stubEnv("PRO_MONTHLY_PRICE_USD", "5");
});
afterAll(() => vi.unstubAllEnvs());
beforeEach(async () => {
  await resetTestDb(db);
  vi.clearAllMocks();
  admin = await createAdmin(db, { username: "admin@tallyhawk.test", password: "Admin-pass1" });
});

const params = <K extends string>(key: K, value: string) => ({ [key]: value }) as Record<K, string>;
const auditActions = async () => (await db.select().from(auditLog)).map((a) => a.action).sort();

describe("access", () => {
  it("admin login accepts admin accounts only", async () => {
    const ok = await call(adminLogin, "POST", "/admin/login", { body: { username: "Admin@Tallyhawk.test", password: "Admin-pass1" } });
    expect(ok.status).toBe(200);
    const claims = await decodeAccessToken(ok.json.access_token);
    expect(claims?.role).toBe("admin");
    expect(claims!.exp! - Date.now() / 1000).toBeLessThanOrEqual(12 * 3600);

    // A customer's correct password is refused exactly like a wrong one.
    await createUser(db, { username: "ada@example.com", password: "Password1" });
    const customer = await call(adminLogin, "POST", "/admin/login", { body: { username: "ada@example.com", password: "Password1" } });
    expect(customer).toMatchObject({ status: 401, json: { detail: "Invalid credentials" } });
    expect((await call(adminLogin, "POST", "/admin/login", { body: { username: "admin@tallyhawk.test", password: "wrong" } })).status).toBe(401);
  });

  it("rejects customers (403) and missing or invalid sessions (401) on every admin route", async () => {
    const { token } = await createUser(db, { username: "ada@example.com" });
    for (const handler of [overview, analytics, listUsers, listAdmins, listFeedback, listContact, listDocuments, auditLogRoute, me]) {
      expect((await call(handler, "GET", "/admin/x", { token })).status).toBe(403);
      expect((await call(handler, "GET", "/admin/x")).status).toBe(401);
    }
  });

  it("drops a suspended admin's session immediately", async () => {
    await db.update(users).set({ status: "suspended" }).where(eq(users.id, admin.user.id));
    expect((await call(overview, "GET", "/admin/overview", { token: admin.token })).status).toBe(401);
  });

  it("returns the admin's own profile without secrets", async () => {
    const res = await call(me, "GET", "/admin/me", { token: admin.token });
    expect(res.json).toMatchObject({ username: "admin@tallyhawk.test", role: "admin", status: "active", plan: null });
    expect(JSON.stringify(res.json)).not.toMatch(/hashed|password|token_version/i);
  });
});

describe("overview and analytics", () => {
  it("summarises customers, documents, billing and support, never counting admins as customers", async () => {
    const ada = await createUser(db, { username: "ada@example.com", plan: "pro" });
    await createUser(db, { username: "comped@example.com", plan: "pro" });
    await createUser(db, { username: "gone@example.com", status: "suspended" });
    await createDocument(db, { ownerId: ada.user.id, extraction: { confidenceScore: 0.9 } });
    await createDocument(db, { ownerId: ada.user.id, status: "FAILED", extraction: null });
    await db.insert(subscriptions).values({ userId: ada.user.id, status: "active", cancelAtPeriodEnd: true });
    await db.insert(feedback).values([{ type: "Bug", message: "x" }, { type: "Idea", message: "y", status: "resolved" }]);
    await db.insert(contactMessages).values({ name: "A", email: "a@b.co", subject: "s", message: "m".repeat(10) });

    const res = await call(overview, "GET", "/admin/overview", { token: admin.token });
    expect(res.json).toMatchObject({
      users: { total: 3, pro: 2, free: 1, suspended: 1, signups_today: 3 },
      admins: { total: 1 },
      documents: { total: 2, by_status: { COMPLETED: 1, FAILED: 1 }, created_today: 2, flagged: 0, avg_confidence: 0.9 },
      billing: { active_subscriptions: 1, canceling_at_period_end: 1, comped_pro: 1, estimated_mrr_usd: 5, price_per_seat_usd: 5 },
      feedback: { total: 2, new: 1, open_bugs: 1 },
      contact: { total: 1, new: 1 },
    });
  });

  it("charts daily activity with empty days filled in, plus breakdowns", async () => {
    const { user } = await createUser(db, { username: "ada@example.com" });
    await createDocument(db, { ownerId: user.id, extraction: { category: "Travel", originalCurrency: "EUR" } });
    await createDocument(db, { ownerId: user.id, status: "FAILED", extraction: null });
    await createDocument(db, { ownerId: user.id, createdAt: new Date(Date.now() - 100 * 86400_000) });

    const res = await call(analytics, "GET", "/admin/analytics?days=7", { token: admin.token });
    expect(res.json.series).toHaveLength(7);
    const today = res.json.series.at(-1);
    expect(today).toMatchObject({ date: new Date().toISOString().slice(0, 10), signups: 1, documents: 2, failed: 1 });
    expect(res.json.totals).toMatchObject({ signups: 1, documents: 2, failed: 1, failure_rate: 0.5 });
    expect(res.json.categories).toEqual([{ name: "Travel", value: 1 }]);
    expect(res.json.currencies).toEqual([{ name: "EUR", value: 1 }]);
    expect(res.json.top_uploaders[0]).toMatchObject({ username: "ada@example.com", documents: 2 });
    expect(res.json.plans).toEqual([{ name: "free", value: 1 }]);
    expect((await call(analytics, "GET", "/admin/analytics?days=3", { token: admin.token })).status).toBe(422);
  });

  it("charts documents per day and validates the window", async () => {
    const { user } = await createUser(db, { username: "ada@example.com" });
    const today = new Date();
    await createDocument(db, { ownerId: user.id, createdAt: today });
    await createDocument(db, { ownerId: user.id, createdAt: today });
    await createDocument(db, { ownerId: user.id, createdAt: new Date(Date.now() - 100 * 86400_000) });

    const res = await call(timeseries, "GET", "/admin/documents/timeseries", { token: admin.token });
    expect(res.json).toEqual([{ date: today.toISOString().slice(0, 10), count: 2 }]);
    expect((await call(timeseries, "GET", "/admin/documents/timeseries?days=180", { token: admin.token })).json).toHaveLength(2);
    expect((await call(timeseries, "GET", "/admin/documents/timeseries?days=0", { token: admin.token })).status).toBe(422);
  });
});

describe("customers", () => {
  it("pages customers only, with counts, filters, search and sorting", async () => {
    const ada = await createUser(db, { username: "ada@example.com", plan: "pro" });
    await createUser(db, { username: "bob_100%@example.com" });
    await createDocument(db, { ownerId: ada.user.id });
    await createDocument(db, { ownerId: ada.user.id });

    const all = await call(listUsers, "GET", "/admin/users", { token: admin.token });
    expect(all.json).toMatchObject({ total: 2, limit: 25, offset: 0 });
    expect(all.json.results.map((u: { username: string }) => u.username)).not.toContain("admin@tallyhawk.test");

    const pro = await call(listUsers, "GET", "/admin/users?plan=pro&limit=1", { token: admin.token });
    expect(pro.json.total).toBe(1); // regression: total ignored the plan filter
    expect(pro.json.results[0]).toMatchObject({ username: "ada@example.com", plan: "pro", document_count: 2 });

    // Wildcards are literal: "%" only matches a real percent sign.
    expect((await call(listUsers, "GET", "/admin/users?search=100%25", { token: admin.token })).json.total).toBe(1);
    expect((await call(listUsers, "GET", "/admin/users?search=ADA", { token: admin.token })).json.total).toBe(1);
    const byDocs = await call(listUsers, "GET", "/admin/users?sort=documents&order=desc", { token: admin.token });
    expect(byDocs.json.results[0].username).toBe("ada@example.com");
    expect((await call(listUsers, "GET", "/admin/users?sort=last_login_at", { token: admin.token })).status).toBe(200);

    for (const bad of ["limit=500", "offset=-1", "plan=gold", "sort=hashed_password", "status=x"]) {
      expect((await call(listUsers, "GET", `/admin/users?${bad}`, { token: admin.token })).status).toBe(422);
    }
  });

  it("shows one customer's account, usage, documents and subscription", async () => {
    const ada = await createUser(db, { username: "ada@example.com", plan: "pro" });
    await createDocument(db, { ownerId: ada.user.id, filename: "a.pdf" });
    await db.insert(subscriptions).values({ userId: ada.user.id, status: "active", stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1" });

    const res = await call(getUser, "GET", `/admin/users/${ada.user.id}`, { token: admin.token, params: params("userId", ada.user.id) });
    expect(res.json).toMatchObject({
      username: "ada@example.com",
      plan: "pro",
      documents: { total: 1, by_status: { COMPLETED: 1 } },
      subscription: { status: "active", stripe_customer_id: "cus_1" },
      usage: { limit: -1 },
      quickbooks_connected: false,
    });
    expect(res.json.documents.recent[0].filename).toBe("a.pdf");
    // Admin accounts aren't customers.
    expect((await call(getUser, "GET", "/admin/users/x", { token: admin.token, params: params("userId", admin.user.id) })).status).toBe(404);
  });

  it("comps or revokes Pro and suspends (signing out) or reactivates, with an audit trail", async () => {
    const ada = await createUser(db, { username: "ada@example.com" });
    const p = { token: admin.token, params: params("userId", ada.user.id) };

    expect((await call(updateUser, "PATCH", "/admin/users/x", { ...p, body: { plan: "pro" } })).json.plan).toBe("pro");
    const suspended = await call(updateUser, "PATCH", "/admin/users/x", { ...p, body: { status: "suspended" } });
    expect(suspended.json.status).toBe("suspended");
    expect((await call(customerDocuments, "GET", "/documents", { token: ada.token })).status).toBe(401);

    await call(updateUser, "PATCH", "/admin/users/x", { ...p, body: { status: "active" } });
    expect((await db.select().from(users).where(eq(users.id, ada.user.id)))[0].status).toBe("active");

    const [entry] = (await db.select().from(auditLog)).filter((a) => (a.details as { plan?: unknown })?.plan);
    expect(entry).toMatchObject({ actorUsername: "admin@tallyhawk.test", action: "user.update", targetLabel: "ada@example.com", details: { plan: { from: "free", to: "pro" } } });
    expect(entry.ipHash).toMatch(/^[0-9a-f]{32}$/);
    expect((await call(updateUser, "PATCH", "/admin/users/x", { ...p, body: {} })).status).toBe(422);
    expect((await call(updateUser, "PATCH", "/admin/users/x", { ...p, body: { role: "admin" } })).status).toBe(422);
  });

  it("signs a customer out everywhere and emails them a reset link", async () => {
    const ada = await createUser(db, { username: "ada@example.com" });
    const p = { token: admin.token, params: params("userId", ada.user.id) };
    expect((await call(signOutUser, "POST", "/admin/users/x/sign-out", p)).status).toBe(204);
    expect((await call(customerDocuments, "GET", "/documents", { token: ada.token })).status).toBe(401);

    vi.spyOn(console, "info").mockImplementation(() => {});
    const reset = await call(resetUserPassword, "POST", "/admin/users/x/password-reset", p);
    expect(reset.json.message).toContain("ada@example.com");
    expect(email.sendPasswordResetEmail).toHaveBeenCalledWith("ada@example.com", expect.stringContaining("/reset-password?token="));
    expect(await auditActions()).toEqual(["user.password_reset", "user.sign_out"]);
  });

  it("deletes a customer, cancelling billing and removing files", async () => {
    const ada = await createUser(db, { username: "ada@example.com", plan: "pro" });
    await createDocument(db, { ownerId: ada.user.id, filename: "a.pdf" });
    await db.insert(subscriptions).values({ userId: ada.user.id, status: "active", stripeSubscriptionId: "sub_1" });
    const res = await call(deleteUser, "DELETE", "/admin/users/x", { token: admin.token, params: params("userId", ada.user.id) });
    expect(res.status).toBe(204);
    expect(stripeMock.cancel).toHaveBeenCalledWith("sub_1");
    expect(storage.deleteFromStorage).toHaveBeenCalledWith("a.pdf");
    expect(await db.select().from(users).where(eq(users.id, ada.user.id))).toEqual([]);
    expect((await db.select().from(auditLog))[0]).toMatchObject({ action: "user.delete", targetLabel: "ada@example.com" });
  });
});

describe("admins", () => {
  it("lists admins and creates new admin accounts (never by promoting a customer)", async () => {
    await createUser(db, { username: "ada@example.com" });
    const created = await call(createAdminRoute, "POST", "/admin/admins", { token: admin.token, body: { username: "New@Tallyhawk.test", password: "Second-admin1" } });
    expect(created).toMatchObject({ status: 201, json: { username: "new@tallyhawk.test", role: "admin" } });
    expect((await call(adminLogin, "POST", "/admin/login", { body: { username: "new@tallyhawk.test", password: "Second-admin1" } })).status).toBe(200);

    const taken = await call(createAdminRoute, "POST", "/admin/admins", { token: admin.token, body: { username: "ADA@example.com", password: "Second-admin1" } });
    expect(taken.status).toBe(400);
    expect((await call(createAdminRoute, "POST", "/admin/admins", { token: admin.token, body: { username: "x@t.co", password: "weak" } })).status).toBe(422);

    const list = await call(listAdmins, "GET", "/admin/admins", { token: admin.token });
    expect(list.json.map((a: { username: string; is_you: boolean }) => [a.username, a.is_you])).toEqual([
      ["admin@tallyhawk.test", true],
      ["new@tallyhawk.test", false],
    ]);
    expect(await auditActions()).toEqual(["admin.create"]);
  });

  it("suspends, reactivates and deletes other admins, but never yourself", async () => {
    const other = await createAdmin(db, { username: "other@tallyhawk.test" });
    const on = (id: string) => ({ token: admin.token, params: params("adminId", id) });

    const self = await call(updateAdmin, "PATCH", "/admin/admins/x", { ...on(admin.user.id), body: { status: "suspended" } });
    expect(self).toMatchObject({ status: 400, json: { detail: expect.stringContaining("your own") } });
    expect((await call(deleteAdmin, "DELETE", "/admin/admins/x", on(admin.user.id))).status).toBe(400);

    expect((await call(updateAdmin, "PATCH", "/admin/admins/x", { ...on(other.user.id), body: { status: "suspended" } })).json.status).toBe("suspended");
    expect((await call(overview, "GET", "/admin/overview", { token: other.token })).status).toBe(401);
    // A suspended admin can't act, so the one who suspended them always remains active.
    expect((await call(updateAdmin, "PATCH", "/admin/admins/x", { token: other.token, params: params("adminId", admin.user.id), body: { status: "suspended" } })).status).toBe(401);
    expect((await call(updateAdmin, "PATCH", "/admin/admins/x", { ...on(other.user.id), body: { status: "active" } })).json.status).toBe("active");
    // Reactivation signed nobody back in: the old session stays revoked.
    expect((await call(overview, "GET", "/admin/overview", { token: other.token })).status).toBe(401);

    expect((await call(deleteAdmin, "DELETE", "/admin/admins/x", on(other.user.id))).status).toBe(204);
    expect((await call(deleteAdmin, "DELETE", "/admin/admins/x", on("missing"))).status).toBe(404);
    expect(await auditActions()).toEqual(["admin.delete", "admin.reactivate", "admin.suspend"]);
  });

  it("refuses to treat a customer as an admin", async () => {
    const ada = await createUser(db, { username: "ada@example.com" });
    expect((await call(deleteAdmin, "DELETE", "/admin/admins/x", { token: admin.token, params: params("adminId", ada.user.id) })).status).toBe(404);
  });
});

describe("feedback and bug reports", () => {
  it("filters by type, status and text, with per-status counts", async () => {
    const ada = await createUser(db, { username: "ada@example.com" });
    await db.insert(feedback).values([
      { type: "Bug", message: "old crash", createdAt: new Date("2026-01-01T00:00:00Z") },
      { type: "Bug", message: "new crash", userId: ada.user.id, page: "/app", status: "in_progress", createdAt: new Date("2026-02-01T00:00:00Z") },
      { type: "Suggestion", message: "dark mode", createdAt: new Date("2026-03-01T00:00:00Z") },
    ]);
    const bugs = await call(listFeedback, "GET", "/admin/feedback?type=Bug", { token: admin.token });
    expect(bugs.json.total).toBe(2);
    expect(bugs.json.results[0]).toMatchObject({ message: "new crash", username: "ada@example.com", page: "/app", status: "in_progress", created_at: "2026-02-01T00:00:00.000Z" });
    expect(bugs.json.status_counts).toEqual({ new: 1, in_progress: 1 });
    expect((await call(listFeedback, "GET", "/admin/feedback?type=Bug&status=new", { token: admin.token })).json.results[0].message).toBe("old crash");
    expect((await call(listFeedback, "GET", "/admin/feedback?search=DARK", { token: admin.token })).json.total).toBe(1);
    expect((await call(listFeedback, "GET", "/admin/feedback?status=bogus", { token: admin.token })).status).toBe(422);
  });

  it("triages, annotates and deletes feedback", async () => {
    const [row] = await db.insert(feedback).values({ type: "Bug", message: "crash" }).returning();
    const p = { token: admin.token, params: params("feedbackId", row.id) };
    const res = await call(updateFeedback, "PATCH", "/admin/feedback/x", { ...p, body: { status: "resolved", admin_note: "Fixed in 1.2" } });
    expect(res.json).toMatchObject({ status: "resolved", admin_note: "Fixed in 1.2" });
    expect(res.json.updated_at).not.toBeNull();
    expect((await call(updateFeedback, "PATCH", "/admin/feedback/x", { ...p, body: { admin_note: "" } })).json.admin_note).toBeNull();
    expect((await call(updateFeedback, "PATCH", "/admin/feedback/x", { ...p, body: { status: "done" } })).status).toBe(422);
    expect((await call(deleteFeedback, "DELETE", "/admin/feedback/x", p)).status).toBe(204);
    expect((await call(deleteFeedback, "DELETE", "/admin/feedback/x", p)).status).toBe(404);
    expect(await auditActions()).toEqual(["feedback.delete", "feedback.update", "feedback.update"]);
  });
});

describe("contact messages", () => {
  it("lists, searches, triages and deletes contact form submissions", async () => {
    await db.insert(contactMessages).values([
      { name: "Ada", email: "ada@example.com", subject: "Refund", message: "Please refund me", createdAt: new Date("2026-01-01T00:00:00Z") },
      { name: "Bob", email: "bob@example.com", subject: "Partnership", message: "Let's talk business", createdAt: new Date("2026-02-01T00:00:00Z") },
    ]);
    const list = await call(listContact, "GET", "/admin/contact", { token: admin.token });
    expect(list.json.results.map((m: { name: string }) => m.name)).toEqual(["Bob", "Ada"]);
    expect(list.json.status_counts).toEqual({ new: 2 });
    expect((await call(listContact, "GET", "/admin/contact?search=refund", { token: admin.token })).json.total).toBe(1);

    const id = list.json.results[0].id;
    const p = { token: admin.token, params: params("messageId", id) };
    expect((await call(updateContact, "PATCH", "/admin/contact/x", { ...p, body: { status: "in_progress" } })).json.status).toBe("in_progress");
    expect((await call(listContact, "GET", "/admin/contact?status=new", { token: admin.token })).json.total).toBe(1);
    expect((await call(deleteContact, "DELETE", "/admin/contact/x", p)).status).toBe(204);
    expect((await call(updateContact, "PATCH", "/admin/contact/x", { ...p, body: { status: "resolved" } })).status).toBe(404);
    expect((await db.select().from(auditLog)).map((a) => a.targetLabel)).toEqual(["bob@example.com: Partnership", "bob@example.com: Partnership"]);
  });
});

describe("documents", () => {
  it("lists documents across customers, filterable by status, flags and owner", async () => {
    const ada = await createUser(db, { username: "ada@example.com" });
    const bob = await createUser(db, { username: "bob@example.com" });
    await createDocument(db, { ownerId: ada.user.id, filename: "a.pdf", status: "FAILED", extraction: null });
    const { doc } = await createDocument(db, { ownerId: bob.user.id, filename: "b.pdf" });
    await db.update(documents).set({ flags: "duplicate" }).where(eq(documents.id, doc.id));

    expect((await call(listDocuments, "GET", "/admin/documents", { token: admin.token })).json.total).toBe(2);
    const failed = await call(listDocuments, "GET", "/admin/documents?status=FAILED", { token: admin.token });
    expect(failed.json.results).toEqual([expect.objectContaining({ filename: "a.pdf", owner_username: "ada@example.com" })]);
    expect(failed.json.results[0]).not.toHaveProperty("s3_url");
    expect((await call(listDocuments, "GET", "/admin/documents?flagged=true", { token: admin.token })).json.results[0].filename).toBe("b.pdf");
    expect((await call(listDocuments, "GET", "/admin/documents?search=bob", { token: admin.token })).json.total).toBe(1);
  });

  it("reprocesses failed or stuck documents only", async () => {
    const ada = await createUser(db, { username: "ada@example.com" });
    const failed = await createDocument(db, { ownerId: ada.user.id, status: "FAILED" });
    const fresh = await createDocument(db, { ownerId: ada.user.id, status: "PROCESSING", extraction: null });
    const stuck = await createDocument(db, { ownerId: ada.user.id, status: "PROCESSING", extraction: null, createdAt: new Date(Date.now() - 60 * 60 * 1000) });
    const done = await createDocument(db, { ownerId: ada.user.id });
    const on = (id: string) => ({ token: admin.token, params: params("documentId", id) });

    expect((await call(reprocess, "POST", "/admin/documents/x/reprocess", on(failed.doc.id))).json.status).toBe("PENDING");
    expect(await db.select().from(extractions).where(eq(extractions.documentId, failed.doc.id))).toEqual([]);
    expect((await call(reprocess, "POST", "/admin/documents/x/reprocess", on(stuck.doc.id))).status).toBe(200);
    expect((await call(reprocess, "POST", "/admin/documents/x/reprocess", on(fresh.doc.id))).status).toBe(409);
    expect((await call(reprocess, "POST", "/admin/documents/x/reprocess", on(done.doc.id))).status).toBe(409);
    expect((await call(reprocess, "POST", "/admin/documents/x/reprocess", on("missing"))).status).toBe(404);

    await flushBackground();
    expect(pipeline.processDocument.mock.calls.map((c) => (c as unknown[])[0])).toEqual([failed.doc.id, stuck.doc.id]);
    expect(await auditActions()).toEqual(["document.reprocess", "document.reprocess"]);
  });
});

describe("audit log", () => {
  it("lists admin actions newest first, filterable by area and text", async () => {
    const ada = await createUser(db, { username: "ada@example.com" });
    await call(signOutUser, "POST", "/admin/users/x/sign-out", { token: admin.token, params: params("userId", ada.user.id) });
    await call(createAdminRoute, "POST", "/admin/admins", { token: admin.token, body: { username: "second@tallyhawk.test", password: "Second-admin1" } });

    const all = await call(auditLogRoute, "GET", "/admin/audit-log", { token: admin.token });
    expect(all.json.total).toBe(2);
    expect(all.json.results[0]).toMatchObject({ action: "admin.create", actor_username: "admin@tallyhawk.test", target_label: "second@tallyhawk.test" });
    expect(all.json.results[0]).not.toHaveProperty("ip_hash");
    expect((await call(auditLogRoute, "GET", "/admin/audit-log?area=user", { token: admin.token })).json.results[0].action).toBe("user.sign_out");
    expect((await call(auditLogRoute, "GET", "/admin/audit-log?search=ada@", { token: admin.token })).json.total).toBe(1);
    expect((await call(auditLogRoute, "GET", `/admin/audit-log?actor=${admin.user.id}`, { token: admin.token })).json.total).toBe(2);
  });
});
