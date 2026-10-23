// @vitest-environment node
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createAccessToken, decodeAccessToken, verifyPassword } from "@/server/auth";
import type { Db } from "@/server/db";
import { documents, extractions, passwordResetTokens, quickbooksConnections, users, vendors } from "@/server/db/schema";
import { call, createDocument, createTestDb, createUser, flushBackground, resetTestDb, stubFetch } from "@/test/server";
import { POST as changePassword } from "./change-password/route";
import { DELETE as deleteAccount } from "./delete/route";
import { POST as forgotPassword } from "./forgot-password/route";
import { POST as login } from "./login/route";
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
    const res = await call(signup, "POST", "/auth/signup", { body: { username: "new@tallyhawk.com", password: "password123" } });
    expect(res.status).toBe(201);
    expect(res.json.token_type).toBe("bearer");
    expect((await decodeAccessToken(res.json.access_token))?.sub).toBe("new@tallyhawk.com");

    const [row] = await db.select().from(users).where(eq(users.username, "new@tallyhawk.com"));
    expect(row.plan).toBe("free");
    expect(row.baseCurrency).toBe("USD");
    expect(row.hashedPassword).toMatch(/^\$2[aby]\$/);
  });

  it("rejects a duplicate email", async () => {
    await call(signup, "POST", "/auth/signup", { body: { username: "dup@test.com", password: "password123" } });
    const res = await call(signup, "POST", "/auth/signup", { body: { username: "dup@test.com", password: "password123" } });
    expect(res.status).toBe(400);
    expect(res.json.detail).toContain("already registered");
  });

  it("validates the body like FastAPI (422)", async () => {
    const res = await call(signup, "POST", "/auth/signup", { body: { username: "x" } });
    expect(res.status).toBe(422);
    expect(res.json.detail[0].loc).toEqual(["body", "password"]);
    expect((await call(signup, "POST", "/auth/signup", { body: "{not json" })).status).toBe(422);
  });

  it("logs in with a token carrying the plan", async () => {
    await createUser(db, { username: "login@test.com", password: "password123", plan: "pro" });
    const res = await call(login, "POST", "/auth/login", { body: { username: "login@test.com", password: "password123" } });
    expect(res.status).toBe(200);
    const claims = await decodeAccessToken(res.json.access_token);
    expect(claims).toMatchObject({ sub: "login@test.com", plan: "pro" });
    expect(claims!.exp! - Date.now() / 1000).toBeGreaterThan(23 * 3600);
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
});

describe("change password", () => {
  it("requires the current password", async () => {
    const { token } = await createUser(db, { password: "old-pass" });
    const bad = await call(changePassword, "POST", "/auth/change-password", { token, body: { current_password: "nope", new_password: "new-pass" } });
    expect(bad.status).toBe(400);

    const ok = await call(changePassword, "POST", "/auth/change-password", { token, body: { current_password: "old-pass", new_password: "new-pass" } });
    expect(ok.status).toBe(200);
    expect((await call(login, "POST", "/auth/login", { body: { username: "ada@example.com", password: "new-pass" } })).status).toBe(200);
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
    await db.insert(passwordResetTokens).values({ userId: user.id, token: "t" });

    const res = await call(deleteAccount, "DELETE", "/auth/delete", { token });
    expect(res.status).toBe(204);
    expect(storage.deleteFromStorage).toHaveBeenCalledWith("account-delete.pdf");
    expect(await db.select().from(users).where(eq(users.id, user.id))).toEqual([]);
    expect(await db.select().from(documents).where(eq(documents.id, doc.id))).toEqual([]);
    expect(await db.select().from(extractions).where(eq(extractions.documentId, doc.id))).toEqual([]);
    expect(await db.select().from(documents)).toHaveLength(1); // the other user's document survives
  });

  it("keeps the database intact if file deletion fails", async () => {
    const { user, token } = await createUser(db);
    await createDocument(db, { ownerId: user.id });
    storage.deleteFromStorage.mockRejectedValueOnce(new Error("storage down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await call(deleteAccount, "DELETE", "/auth/delete", { token })).status).toBe(500);
    expect(await db.select().from(users)).toHaveLength(1);
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
    const token = new URL(link).searchParams.get("token");

    const ok = await call(resetPassword, "POST", "/auth/reset-password", { body: { token, new_password: "brand-new" } });
    expect(ok.status).toBe(200);
    expect((await call(login, "POST", "/auth/login", { body: { username: "ada@example.com", password: "brand-new" } })).status).toBe(200);

    const reused = await call(resetPassword, "POST", "/auth/reset-password", { body: { token, new_password: "again" } });
    expect(reused.json.detail).toBe("Token has already been used.");
  });

  it("still succeeds when the email provider fails", async () => {
    await createUser(db);
    email.sendPasswordResetEmail.mockRejectedValueOnce(new Error("resend down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await call(forgotPassword, "POST", "/auth/forgot-password", { body: { email: "ada@example.com" } })).status).toBe(200);
  });

  it("rejects unknown and expired tokens", async () => {
    const { user } = await createUser(db);
    await db.insert(passwordResetTokens).values({ userId: user.id, token: "expired", expiresAt: new Date(Date.now() - 1000) });
    expect((await call(resetPassword, "POST", "/auth/reset-password", { body: { token: "nope", new_password: "x" } })).json.detail).toBe(
      "Invalid or expired token."
    );
    expect((await call(resetPassword, "POST", "/auth/reset-password", { body: { token: "expired", new_password: "x" } })).json.detail).toBe(
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
