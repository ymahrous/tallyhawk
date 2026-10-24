// @vitest-environment node
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createAccessToken, decodeAccessToken, hashResetToken, verifyPassword } from "@/server/auth";
import type { Db } from "@/server/db";
import { deletedAccounts, documents, extractions, passwordResetTokens, quickbooksConnections, users, vendors } from "@/server/db/schema";
import { call, createAdmin, createDocument, createTestDb, createUser, flushBackground, resetTestDb, stubFetch } from "@/test/server";
import { POST as changePassword } from "./change-password/route";
import { DELETE as deleteAccount } from "./delete/route";
import { POST as forgotPassword } from "./forgot-password/route";
import { POST as login } from "./login/route";
import { POST as logoutAll } from "./logout-all/route";
import { POST as refresh } from "./refresh/route";
import { POST as resetPassword } from "./reset-password/route";
import { GET as getSettings, PATCH as patchSettings } from "./settings/route";
import { POST as signup } from "./signup/route";
import { GET as listDocuments } from "../documents/route";

vi.mock("@/server/background", async () => (await import("@/test/server")).backgroundMock);
const storage = vi.hoisted(() => ({ deleteFromStorage: vi.fn(async () => {}), uploadToStorage: vi.fn() }));
vi.mock("@/server/storage", () => storage);
const email = vi.hoisted(() => ({ sendPasswordResetEmail: vi.fn(async () => {}) }));
vi.mock("@/server/email", () => email);

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
});
beforeEach(async () => {
  await resetTestDb(db);
  vi.clearAllMocks();
});

describe("signup and login", () => {
  it("signs up and returns a token for the new user", async () => {
    const res = await call(signup, "POST", "/auth/signup", { body: { username: " new@tallyhawk.com ", password: "Password123" } });
    expect(res.status).toBe(201);
    expect(res.json.token_type).toBe("bearer");
    // Same claims as login (regression: the signup token had no plan for the client to seed from).
    expect(await decodeAccessToken(res.json.access_token)).toMatchObject({ sub: "new@tallyhawk.com", plan: "free" });

    const [row] = await db.select().from(users).where(eq(users.username, "new@tallyhawk.com"));
    expect(row.plan).toBe("free");
    expect(row.baseCurrency).toBe("USD");
    expect(row.hashedPassword).toMatch(/^\$2[aby]\$/);
  });

  it("rejects a duplicate email", async () => {
    await call(signup, "POST", "/auth/signup", { body: { username: "dup@test.com", password: "Password123" } });
    const res = await call(signup, "POST", "/auth/signup", { body: { username: "dup@test.com", password: "Password123" } });
    expect(res.status).toBe(400);
    expect(res.json.detail).toContain("already registered");
  });

  it("validates the body like FastAPI (422)", async () => {
    const res = await call(signup, "POST", "/auth/signup", { body: { username: "x@test.com" } });
    expect(res.status).toBe(422);
    expect(res.json.detail[0].loc).toEqual(["body", "password"]);
    expect((await call(signup, "POST", "/auth/signup", { body: "{not json" })).status).toBe(422);
  });

  it("enforces the signup form's email and password rules (regression: the API accepted anything)", async () => {
    const weak = await call(signup, "POST", "/auth/signup", { body: { username: "ok@test.com", password: "password123" } });
    expect(weak.status).toBe(422);
    expect(weak.json.detail).toEqual([
      { loc: ["body", "password"], msg: "Password must contain at least one uppercase letter.", type: "custom" },
    ]);
    const notEmail = await call(signup, "POST", "/auth/signup", { body: { username: "not-an-email", password: "Password123" } });
    expect(notEmail.json.detail[0]).toMatchObject({ loc: ["body", "username"], msg: "Please enter a valid email address." });
    expect(await db.select().from(users)).toEqual([]);
  });

  it("logs in with a token carrying the plan", async () => {
    await createUser(db, { username: "login@test.com", password: "password123", plan: "pro" });
    const res = await call(login, "POST", "/auth/login", { body: { username: "login@test.com", password: "password123" } });
    expect(res.status).toBe(200);
    expect(res.json.role).toBe("user");
    const claims = await decodeAccessToken(res.json.access_token);
    expect(claims).toMatchObject({ sub: "login@test.com", plan: "pro", role: "user", ver: 0 });
    expect(claims!.exp! - Date.now() / 1000).toBeGreaterThan(23 * 3600);
    const [row] = await db.select().from(users).where(eq(users.username, "login@test.com"));
    expect(row.lastLoginAt).toBeInstanceOf(Date);
  });

  it("matches emails case-insensitively and stores new ones lowercase", async () => {
    const res = await call(signup, "POST", "/auth/signup", { body: { username: "Mixed@Case.com", password: "Password123" } });
    expect(await decodeAccessToken(res.json.access_token)).toMatchObject({ sub: "mixed@case.com", role: "user" });
    expect((await call(signup, "POST", "/auth/signup", { body: { username: "MIXED@case.com", password: "Password123" } })).status).toBe(400);
    expect((await call(login, "POST", "/auth/login", { body: { username: "MIXED@CASE.COM", password: "Password123" } })).status).toBe(200);
  });

  it("signs admins in with a shorter admin session and no plan", async () => {
    await createAdmin(db, { username: "boss@tallyhawk.test", password: "Admin-pass1" });
    const res = await call(login, "POST", "/auth/login", { body: { username: "boss@tallyhawk.test", password: "Admin-pass1" } });
    expect(res.json.role).toBe("admin");
    const claims = await decodeAccessToken(res.json.access_token);
    expect(claims).toMatchObject({ sub: "boss@tallyhawk.test", role: "admin" });
    expect(claims!.plan).toBeUndefined();
    expect(claims!.exp! - Date.now() / 1000).toBeLessThanOrEqual(12 * 3600);
  });

  it("only tells a suspended account apart from a wrong password when the password is right", async () => {
    await createUser(db, { username: "gone@test.com", password: "password123", status: "suspended" });
    expect((await call(login, "POST", "/auth/login", { body: { username: "gone@test.com", password: "wrong" } })).status).toBe(401);
    const right = await call(login, "POST", "/auth/login", { body: { username: "gone@test.com", password: "password123" } });
    expect(right).toMatchObject({ status: 403, json: { detail: expect.stringContaining("suspended") } });
  });

  it("rate-limits guessing per account, whether or not it exists (no enumeration)", async () => {
    await createUser(db, { username: "real@test.com", password: "password123" });
    for (const username of ["real@test.com", "ghost@test.com"]) {
      for (let i = 0; i < 10; i++) {
        expect((await call(login, "POST", "/auth/login", { body: { username, password: "wrong" } })).status).toBe(401);
      }
      const blocked = await call(login, "POST", "/auth/login", { body: { username, password: "wrong" } });
      expect(blocked.status).toBe(429);
      expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
    }
    // Even the right password waits out the window.
    expect((await call(login, "POST", "/auth/login", { body: { username: "real@test.com", password: "password123" } })).status).toBe(429);
  });

  it("rate-limits by client IP across accounts", async () => {
    const headers = { "x-forwarded-for": "203.0.113.7, 10.0.0.1" };
    for (let i = 0; i < 30; i++) {
      await call(login, "POST", "/auth/login", { body: { username: `u${i}@test.com`, password: "x" }, headers });
    }
    expect((await call(login, "POST", "/auth/login", { body: { username: "new@test.com", password: "x" }, headers })).status).toBe(429);
    // A different client is unaffected.
    expect((await call(login, "POST", "/auth/login", { body: { username: "new@test.com", password: "x" }, headers: { "x-forwarded-for": "198.51.100.1" } })).status).toBe(401);
  });

  it("refuses oversized request bodies before parsing them", async () => {
    const huge = JSON.stringify({ username: "a@b.co", password: "x".repeat(70 * 1024) });
    expect((await call(login, "POST", "/auth/login", { body: huge, headers: { "content-type": "application/json" } })).status).toBe(413);
    expect((await call(login, "POST", "/auth/login", { body: { username: "a@b.co", password: "x".repeat(2000) } })).status).toBe(422);
  });

  it("rejects bad credentials with 401", async () => {
    await createUser(db, { username: "login@test.com", password: "password123" });
    expect((await call(login, "POST", "/auth/login", { body: { username: "login@test.com", password: "wrong" } })).status).toBe(401);
    expect((await call(login, "POST", "/auth/login", { body: { username: "nobody@test.com", password: "x" } })).status).toBe(401);
  });

  it("verifies hashes produced by the Python backend's bcrypt", async () => {
    // bcrypt.hashpw(b"password123", bcrypt.gensalt()) from the former backend
    const pythonHash = "$2b$12$m99NXSipzXE.6/Xws6iKb.dpelt8svM/n6H5xxTPZBU/ExVYEtHRK";
    expect(await verifyPassword("password123", pythonHash)).toBe(true);
    expect(await verifyPassword("password124", pythonHash)).toBe(false);
  });

  it("accepts sessions issued by the Python backend (python-jose, same SECRET_KEY)", async () => {
    await createUser(db, { plan: "pro" });
    // jwt.encode({"sub": "ada@example.com", "plan": "pro", "exp": datetime(2099, 1, 1)}, "test-secret-key", "HS256")
    const pythonToken =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZGFAZXhhbXBsZS5jb20iLCJwbGFuIjoicHJvIiwiZXhwIjo0MDcwOTA4ODAwfQ.VQG7ehqMmv7A1D2oXChBpiK46tp-z166VobswXalbWQ";
    expect((await call(getSettings, "GET", "/auth/settings", { token: pythonToken })).status).toBe(200);
  });
});

describe("authentication guard", () => {
  it("rejects missing, malformed and unknown-user tokens", async () => {
    expect((await call(listDocuments, "GET", "/documents")).status).toBe(401);
    expect((await call(listDocuments, "GET", "/documents", { token: "garbage" })).status).toBe(401);
    const ghost = await createAccessToken({ sub: "ghost@test.com" });
    expect((await call(listDocuments, "GET", "/documents", { token: ghost })).json.detail).toBe("User not found");
    const noSub = await createAccessToken({ sub: "" });
    expect((await call(listDocuments, "GET", "/documents", { token: noSub })).json.detail).toBe("Invalid token payload");
  });

  it("does not accept QuickBooks OAuth state tokens as sessions", async () => {
    const { user } = await createUser(db);
    const state = await createAccessToken({ sub: user.username, role: "qb_oauth" });
    expect((await call(listDocuments, "GET", "/documents", { token: state })).status).toBe(401);
  });

  it("keeps admins out of customer features", async () => {
    const { token } = await createAdmin(db);
    const res = await call(listDocuments, "GET", "/documents", { token });
    expect(res).toMatchObject({ status: 403, json: { detail: "Admin accounts can't use customer features." } });
  });

  it("voids a token whose role doesn't match the account (e.g. an admin token for a customer)", async () => {
    const { user } = await createUser(db);
    const forgedAdmin = await createAccessToken({ sub: user.username, role: "admin" });
    expect((await call(listDocuments, "GET", "/documents", { token: forgedAdmin })).status).toBe(401);
    const admin = await createAdmin(db);
    const customerToken = await createAccessToken({ sub: admin.user.username, plan: "pro" });
    expect((await call(listDocuments, "GET", "/documents", { token: customerToken })).status).toBe(401);
  });

  it("signs out suspended accounts on their next request", async () => {
    const { user, token } = await createUser(db);
    await db.update(users).set({ status: "suspended" }).where(eq(users.id, user.id));
    expect((await call(listDocuments, "GET", "/documents", { token })).json.detail).toBe("This account has been suspended.");
  });
});

describe("sessions", () => {
  it("signs out everywhere, including the session that asked", async () => {
    const { token } = await createUser(db);
    expect((await call(logoutAll, "POST", "/auth/logout-all", { token })).status).toBe(204);
    const after = await call(listDocuments, "GET", "/documents", { token });
    expect(after).toMatchObject({ status: 401, json: { detail: "Session expired. Please log in again." } });
  });

  it("refreshes a session with the account's current claims", async () => {
    const { user, token } = await createUser(db);
    await db.update(users).set({ plan: "pro" }).where(eq(users.id, user.id));
    const res = await call(refresh, "POST", "/auth/refresh", { token });
    expect(await decodeAccessToken(res.json.access_token)).toMatchObject({ plan: "pro", role: "user" });
    expect((await call(refresh, "POST", "/auth/refresh")).status).toBe(401);
  });
});

describe("change password", () => {
  it("requires the current password", async () => {
    const { token } = await createUser(db, { password: "old-pass" });
    const bad = await call(changePassword, "POST", "/auth/change-password", { token, body: { current_password: "nope", new_password: "New-pass1" } });
    expect(bad.status).toBe(400);

    const ok = await call(changePassword, "POST", "/auth/change-password", { token, body: { current_password: "old-pass", new_password: "New-pass1" } });
    expect(ok.status).toBe(200);
    expect((await call(login, "POST", "/auth/login", { body: { username: "ada@example.com", password: "New-pass1" } })).status).toBe(200);

    // Every other session is signed out; this one continues with the token in the response.
    expect((await call(listDocuments, "GET", "/documents", { token })).status).toBe(401);
    expect((await call(listDocuments, "GET", "/documents", { token: ok.json.access_token })).status).toBe(200);
  });

  it("lets admins change their own password too", async () => {
    const { token } = await createAdmin(db, { password: "Admin-pass1" });
    const ok = await call(changePassword, "POST", "/auth/change-password", { token, body: { current_password: "Admin-pass1", new_password: "Admin-pass2" } });
    expect(ok.json.role).toBe("admin");
  });

  it("applies the password policy to the new password", async () => {
    const { token } = await createUser(db, { password: "old-pass" });
    const res = await call(changePassword, "POST", "/auth/change-password", { token, body: { current_password: "old-pass", new_password: "short1A" } });
    expect(res).toMatchObject({ status: 422, json: { detail: [{ loc: ["body", "new_password"], msg: "Password must be at least 8 characters." }] } });
    expect((await call(login, "POST", "/auth/login", { body: { username: "ada@example.com", password: "old-pass" } })).status).toBe(200);
  });
});

describe("delete account", () => {
  it("removes the user and everything they own, files first", async () => {
    const { user, token } = await createUser(db);
    const other = await createUser(db, { username: "other@test.com" });
    const { doc } = await createDocument(db, { ownerId: user.id, filename: "account-delete.pdf", extraction: { extractedData: { invoice_number: "456" } } });
    await createDocument(db, { ownerId: other.user.id });
    await db.insert(vendors).values({ userId: user.id, canonicalName: "Acme" });
    await db.insert(quickbooksConnections).values({ userId: user.id, realmId: "r1" });
    await db.insert(passwordResetTokens).values({ userId: user.id, token: hashResetToken("t") });

    const res = await call(deleteAccount, "DELETE", "/auth/delete", { token });
    expect(res.status).toBe(204);
    expect(storage.deleteFromStorage).toHaveBeenCalledWith("account-delete.pdf");
    expect(await db.select().from(users).where(eq(users.id, user.id))).toEqual([]);
    expect(await db.select().from(documents).where(eq(documents.id, doc.id))).toEqual([]);
    expect(await db.select().from(extractions).where(eq(extractions.documentId, doc.id))).toEqual([]);
    expect(await db.select().from(documents)).toHaveLength(1); // the other user's document survives

    // Only the deletion record remains, with no subscription to report.
    expect(await db.select().from(deletedAccounts)).toEqual([
      expect.objectContaining({ userId: user.id, username: "ada@example.com", role: "user", plan: "free", deletedBy: "self", lifetimeDocuments: 0, stripeSubscriptionId: null, subscriptionStatus: null }),
    ]);
  });

  it("keeps the database intact if file deletion fails", async () => {
    const { user, token } = await createUser(db);
    await createDocument(db, { ownerId: user.id });
    storage.deleteFromStorage.mockRejectedValueOnce(new Error("storage down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await call(deleteAccount, "DELETE", "/auth/delete", { token })).status).toBe(500);
    expect(await db.select().from(users)).toHaveLength(1);
    expect(await db.select().from(deletedAccounts)).toEqual([]);
  });
});

describe("password reset", () => {
  it("answers identically whether or not the account exists", async () => {
    await createUser(db);
    const known = await call(forgotPassword, "POST", "/auth/forgot-password", { body: { email: "ada@example.com" } });
    const unknown = await call(forgotPassword, "POST", "/auth/forgot-password", { body: { email: "nobody@example.com" } });
    expect(known.status).toBe(200);
    expect(known.json).toEqual(unknown.json);
    expect(email.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
  });

  it("emails a link on the app's own origin and resets once", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    await createUser(db, { password: "old-pass" });
    await call(forgotPassword, "POST", "/auth/forgot-password", { body: { email: "ada@example.com" } });
    const [to, link] = email.sendPasswordResetEmail.mock.calls[0] as unknown as [string, string];
    expect(to).toBe("ada@example.com");
    expect(link).toMatch(/^http:\/\/localhost:3000\/reset-password\?token=[\w-]{43}$/);
    const token = new URL(link).searchParams.get("token")!;
    // Only the hash is stored: a database leak doesn't hand out working links.
    const [stored] = await db.select().from(passwordResetTokens);
    expect(stored.token).toBe(hashResetToken(token));
    expect(stored.token).not.toContain(token);

    const weak = await call(resetPassword, "POST", "/auth/reset-password", { body: { token, new_password: "brand-new" } });
    expect(weak.status).toBe(422); // the reset form's policy is enforced here too, and the token stays usable

    const ok = await call(resetPassword, "POST", "/auth/reset-password", { body: { token, new_password: "Brand-new1" } });
    expect(ok.status).toBe(200);
    expect((await call(login, "POST", "/auth/login", { body: { username: "ada@example.com", password: "Brand-new1" } })).status).toBe(200);

    const reused = await call(resetPassword, "POST", "/auth/reset-password", { body: { token, new_password: "Again-new1" } });
    expect(reused.json.detail).toBe("Token has already been used.");
  });

  it("signs out existing sessions and voids older links", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const { token: session } = await createUser(db);
    await call(forgotPassword, "POST", "/auth/forgot-password", { body: { email: "ada@example.com" } });
    await call(forgotPassword, "POST", "/auth/forgot-password", { body: { email: "ADA@example.com" } });
    const links = email.sendPasswordResetEmail.mock.calls.map((c) => new URL((c as unknown as [string, string])[1]).searchParams.get("token"));
    expect(links).toHaveLength(2);

    const old = await call(resetPassword, "POST", "/auth/reset-password", { body: { token: links[0], new_password: "Brand-new1" } });
    expect(old.json.detail).toBe("Invalid or expired token.");
    expect((await call(resetPassword, "POST", "/auth/reset-password", { body: { token: links[1], new_password: "Brand-new1" } })).status).toBe(200);
    expect((await call(listDocuments, "GET", "/documents", { token: session })).status).toBe(401);
  });

  it("limits reset emails per address", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    await createUser(db);
    for (let i = 0; i < 3; i++) await call(forgotPassword, "POST", "/auth/forgot-password", { body: { email: "ada@example.com" } });
    expect((await call(forgotPassword, "POST", "/auth/forgot-password", { body: { email: "ada@example.com" } })).status).toBe(429);
    expect(email.sendPasswordResetEmail).toHaveBeenCalledTimes(3);
  });

  it("still succeeds when the email provider fails", async () => {
    await createUser(db);
    email.sendPasswordResetEmail.mockRejectedValueOnce(new Error("resend down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await call(forgotPassword, "POST", "/auth/forgot-password", { body: { email: "ada@example.com" } })).status).toBe(200);
  });

  it("rejects unknown and expired tokens", async () => {
    const { user } = await createUser(db);
    await db.insert(passwordResetTokens).values({ userId: user.id, token: hashResetToken("expired"), expiresAt: new Date(Date.now() - 1000) });
    expect((await call(resetPassword, "POST", "/auth/reset-password", { body: { token: "nope", new_password: "Password1" } })).json.detail).toBe(
      "Invalid or expired token."
    );
    expect((await call(resetPassword, "POST", "/auth/reset-password", { body: { token: "expired", new_password: "Password1" } })).json.detail).toBe(
      "Token has expired."
    );
  });
});

describe("settings", () => {
  it("returns the user's settings", async () => {
    const { user, token } = await createUser(db, { plan: "pro", baseCurrency: "EUR" });
    const res = await call(getSettings, "GET", "/auth/settings", { token });
    expect(res.json).toEqual({ id: user.id, username: "ada@example.com", plan: "pro", base_currency: "EUR", created_at: user.createdAt.toISOString() });
  });

  it("normalises and validates the currency code", async () => {
    const { token } = await createUser(db);
    expect((await call(patchSettings, "PATCH", "/auth/settings", { token, body: { base_currency: "INVALID" } })).status).toBe(422);
    expect((await call(patchSettings, "PATCH", "/auth/settings", { token, body: { base_currency: "" } })).status).toBe(422);
    expect((await call(patchSettings, "PATCH", "/auth/settings", { token, body: {} })).json.base_currency).toBe("USD");
    expect((await call(patchSettings, "PATCH", "/auth/settings", { token, body: { base_currency: null } })).json.base_currency).toBe("USD");
    expect((await call(patchSettings, "PATCH", "/auth/settings", { token, body: { base_currency: "jpy" } })).json.base_currency).toBe("JPY");
  });

  it("re-converts existing documents in the background when the currency changes", async () => {
    vi.stubEnv("EXCHANGE_RATE_API_KEY", "k");
    stubFetch(() => Response.json({ result: "success", conversion_result: 0.9, conversion_rate: 0.9 }));
    const { user, token } = await createUser(db);
    const { ext } = await createDocument(db, {
      ownerId: user.id,
      extraction: { originalAmount: 100, originalCurrency: "USD", convertedAmount: 100, convertedCurrency: "USD", exchangeRate: 1 },
    });

    await call(patchSettings, "PATCH", "/auth/settings", { token, body: { base_currency: "EUR" } });
    await flushBackground();

    const [row] = await db.select().from(extractions).where(eq(extractions.id, ext!.id));
    expect(row).toMatchObject({ convertedAmount: 90, convertedCurrency: "EUR", exchangeRate: 0.9 });
    vi.unstubAllEnvs();
  });
});
