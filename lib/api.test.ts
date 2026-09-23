import { describe, it, expect, vi, beforeEach } from "vitest";
import * as api from "./api";
import { mockApi } from "@/test/api-mock";
import { makeToken, signIn, signInExpired } from "@/test/auth";

describe("token helpers", () => {
  it("decodeToken returns null when there is no token", () => {
    expect(api.decodeToken()).toBeNull();
  });

  it("decodeToken returns the JWT payload", () => {
    signIn({ sub: "ada@example.com", plan: "pro" });
    expect(api.decodeToken()).toMatchObject({ sub: "ada@example.com", plan: "pro" });
  });

  it("decodeToken returns null for a malformed token", () => {
    localStorage.setItem("token", "not-a-jwt");
    expect(api.decodeToken()).toBeNull();
  });

  it("isTokenExpired is true without a token, for garbage, and past exp", () => {
    expect(api.isTokenExpired()).toBe(true);
    localStorage.setItem("token", "garbage");
    expect(api.isTokenExpired()).toBe(true);
    signInExpired();
    expect(api.isTokenExpired()).toBe(true);
  });

  it("isTokenExpired is false for a token that expires in the future", () => {
    signIn();
    expect(api.isTokenExpired()).toBe(false);
  });

  it("logout removes the token and notifies same-tab listeners", () => {
    signIn();
    const listener = vi.fn();
    window.addEventListener("storage", listener);
    api.logout();
    window.removeEventListener("storage", listener);
    expect(localStorage.getItem("token")).toBeNull();
    expect(listener).toHaveBeenCalledOnce();
  });
});

describe("login", () => {
  it("posts credentials and stores the returned token", async () => {
    const token = makeToken();
    const server = mockApi({
      "POST /auth/login": { json: { access_token: token, token_type: "bearer" } },
    });

    await api.login("ada@example.com", "Secret123");

    expect(localStorage.getItem("token")).toBe(token);
    expect(server.callsTo("POST /auth/login")[0].body).toEqual({
      username: "ada@example.com",
      password: "Secret123",
    });
  });

  it("surfaces the backend's error detail", async () => {
    mockApi({
      "POST /auth/login": { status: 401, json: { detail: "Incorrect email or password" } },
    });
    await expect(api.login("ada@example.com", "nope")).rejects.toThrow(
      "Incorrect email or password"
    );
  });

  it("falls back to a generic message when the error body isn't JSON", async () => {
    mockApi({ "POST /auth/login": { status: 500, body: "<html>oops</html>" } });
    await expect(api.login("ada@example.com", "nope")).rejects.toThrow("Invalid credentials");
  });
});

describe("signup", () => {
  it("creates the account and stores the token", async () => {
    const token = makeToken();
    const server = mockApi({ "POST /auth/signup": { json: { access_token: token } } });

    await api.signup("ada@example.com", "Secret123");

    expect(localStorage.getItem("token")).toBe(token);
    expect(server.callsTo("POST /auth/signup")[0].body).toEqual({
      username: "ada@example.com",
      password: "Secret123",
    });
  });

  it("throws the backend detail on failure", async () => {
    mockApi({ "POST /auth/signup": { status: 400, json: { detail: "Email already registered" } } });
    await expect(api.signup("ada@example.com", "Secret123")).rejects.toThrow(
      "Email already registered"
    );
  });

  it("uses a default message when the body is empty", async () => {
    mockApi({ "POST /auth/signup": { status: 500, body: "" } });
    await expect(api.signup("ada@example.com", "Secret123")).rejects.toThrow("Signup failed");
  });
});

describe("authFetch (via protected endpoints)", () => {
  it("attaches the bearer token", async () => {
    const token = signIn();
    const server = mockApi({ "GET /documents/": { json: [] } });

    await api.getDocuments();

    expect(server.requests[0].headers.get("Authorization")).toBe(`Bearer ${token}`);
  });

  it("rejects before calling the network when the token has expired, and clears it", async () => {
    signInExpired();
    const server = mockApi();

    await expect(api.getDocuments()).rejects.toThrow("Session expired");
    expect(server.requests).toHaveLength(0);
    expect(localStorage.getItem("token")).toBeNull();
  });

  it("treats a 401 as an expired session and clears the token", async () => {
    signIn();
    mockApi({ "GET /documents/": { status: 401, json: { detail: "Unauthorized" } } });

    await expect(api.getDocuments()).rejects.toThrow("Session expired");
    expect(localStorage.getItem("token")).toBeNull();
  });

  it("passes the abort signal through", async () => {
    signIn();
    mockApi({ "GET /documents/": { json: [] } });
    const controller = new AbortController();
    controller.abort();

    await expect(api.getDocuments(controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("documents", () => {
  beforeEach(() => {
    signIn();
  });

  it("uploads the file as multipart form data", async () => {
    const server = mockApi({
      "POST /upload/": { json: { id: "doc-1", filename: "r.pdf", status: "PENDING" } },
    });
    const file = new File(["%PDF"], "r.pdf", { type: "application/pdf" });

    const doc = await api.uploadDocument(file);

    expect(doc.id).toBe("doc-1");
    const body = server.callsTo("POST /upload/")[0].body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect((body.get("file") as File).name).toBe("r.pdf");
  });

  it("maps the free-tier limit error to limit_exceeded", async () => {
    mockApi({ "POST /upload/": { status: 403, json: { detail: { error: "limit_exceeded" } } } });
    await expect(api.uploadDocument(new File(["x"], "r.pdf"))).rejects.toThrow("limit_exceeded");
  });

  it("reports other upload failures", async () => {
    mockApi({ "POST /upload/": { status: 500, json: {} } });
    await expect(api.uploadDocument(new File(["x"], "r.pdf"))).rejects.toThrow("Upload failed");
  });

  it("fetches an extraction and rejects while it isn't ready", async () => {
    mockApi({
      "GET /extraction/ready": { json: { document_id: "ready", extracted_data: { vendor: "A" } } },
      "GET /extraction/pending": { status: 404, json: {} },
    });
    await expect(api.getExtraction("ready")).resolves.toMatchObject({ document_id: "ready" });
    await expect(api.getExtraction("pending")).rejects.toThrow("Extraction not ready");
  });

  it("patches a category", async () => {
    const server = mockApi({ "PATCH /extraction/doc-1/category": { json: {} } });
    await api.updateCategory("doc-1", "Travel");
    expect(server.callsTo("PATCH /extraction/doc-1/category")[0].body).toEqual({
      category: "Travel",
    });

    server.set({ "PATCH /extraction/doc-1/category": { status: 422, json: {} } });
    await expect(api.updateCategory("doc-1", "Nope")).rejects.toThrow("Failed to update category");
  });

  it("deletes a document and accepts 204", async () => {
    mockApi({ "DELETE /documents/doc-1": { status: 204 } });
    await expect(api.deleteDocument("doc-1")).resolves.toBeUndefined();
  });

  it("throws when delete fails", async () => {
    mockApi({ "DELETE /documents/doc-1": { status: 500, json: {} } });
    await expect(api.deleteDocument("doc-1")).rejects.toThrow("Failed to delete document");
  });

  it("downloads the tax summary as a named CSV", async () => {
    mockApi({
      "GET /reports/tax-summary?year=2026": {
        body: "category,total\n",
        headers: { "Content-Type": "text/csv" },
      },
    });
    const createObjectURL = vi.fn(() => "blob:tax");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    await api.exportTaxSummary(2026);

    expect(click).toHaveBeenCalledOnce();
    const anchor = click.mock.contexts[0] as HTMLAnchorElement;
    expect(anchor.download).toBe("Tallyhawk_Tax_Summary_2026.csv");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:tax");
    click.mockRestore();
  });

  it("throws when the tax summary export fails", async () => {
    mockApi({ "GET /reports/tax-summary?year=2025": { status: 500, json: {} } });
    await expect(api.exportTaxSummary(2025)).rejects.toThrow("Failed to export tax summary");
  });
});

describe("billing, stats and analytics", () => {
  beforeEach(() => {
    signIn();
  });

  it("reads usage, subscription, stats and checkout URL", async () => {
    mockApi({
      "GET /billing/usage": { json: { plan: "free", documents_processed: 2, limit: 10 } },
      "GET /billing/subscription": {
        json: { plan: "pro", status: "active", current_period_end: null, last_renewal_date: null },
      },
      "GET /stats/dashboard": { json: { processed: 4, synced: 1, month_spend: 12.5 } },
      "POST /billing/create-checkout-session": { json: { url: "https://checkout.stripe.test/s" } },
    });

    await expect(api.getUsage()).resolves.toMatchObject({ documents_processed: 2 });
    await expect(api.getSubscription()).resolves.toMatchObject({ status: "active" });
    await expect(api.getDashboardStats()).resolves.toMatchObject({ processed: 4 });
    await expect(api.createCheckoutSession()).resolves.toEqual({
      url: "https://checkout.stripe.test/s",
    });
  });

  it("throws descriptive errors when billing endpoints fail", async () => {
    mockApi({
      "GET /billing/usage": { status: 500 },
      "GET /billing/subscription": { status: 500 },
      "GET /stats/dashboard": { status: 500 },
      "POST /billing/create-checkout-session": { status: 500 },
    });

    await expect(api.getUsage()).rejects.toThrow("Failed to fetch usage");
    await expect(api.getSubscription()).rejects.toThrow("Failed to fetch subscription");
    await expect(api.getDashboardStats()).rejects.toThrow("Failed to fetch stats");
    await expect(api.createCheckoutSession()).rejects.toThrow("Failed to create checkout session");
  });

  it("adds the month filter only when one is chosen", async () => {
    const server = mockApi({
      "GET /analytics/spend-by-category": { json: [{ name: "Travel", value: 10 }] },
      "GET /analytics/spend-by-vendor": { json: [] },
      "GET /analytics/monthly-trend": { json: [] },
    });

    await api.getCategorySpend(2026);
    await api.getCategorySpend(2026, 3);
    await api.getVendorSpend(2026, 12);
    await api.getMonthlyTrend(2025);

    const searches = server.requests.map((r) => r.url.search);
    expect(searches).toEqual([
      "?year=2026",
      "?year=2026&month=3",
      "?year=2026&month=12",
      "?year=2025",
    ]);
  });

  it("throws when analytics endpoints fail", async () => {
    mockApi({
      "GET /analytics/spend-by-category": { status: 500 },
      "GET /analytics/spend-by-vendor": { status: 500 },
      "GET /analytics/monthly-trend": { status: 500 },
    });
    await expect(api.getCategorySpend(2026)).rejects.toThrow("Failed to fetch category spend");
    await expect(api.getVendorSpend(2026)).rejects.toThrow("Failed to fetch vendor spend");
    await expect(api.getMonthlyTrend(2026)).rejects.toThrow("Failed to fetch monthly trend");
  });
});

describe("QuickBooks", () => {
  beforeEach(() => {
    signIn({ plan: "pro" });
  });

  it("reads the connect URL and status", async () => {
    mockApi({
      "GET /quickbooks/connect": { json: { url: "https://appcenter.intuit.test/connect" } },
      "GET /quickbooks/status": { json: { connected: true } },
    });
    await expect(api.getQuickBooksConnectUrl()).resolves.toEqual({
      url: "https://appcenter.intuit.test/connect",
    });
    await expect(api.getQuickBooksStatus()).resolves.toEqual({ connected: true });
  });

  it("throws when connect or status fail", async () => {
    mockApi({
      "GET /quickbooks/connect": { status: 500 },
      "GET /quickbooks/status": { status: 500 },
    });
    await expect(api.getQuickBooksConnectUrl()).rejects.toThrow(
      "Failed to get QuickBooks connect URL"
    );
    await expect(api.getQuickBooksStatus()).rejects.toThrow("Failed to get QuickBooks status");
  });

  it("syncs a document and surfaces backend detail on failure", async () => {
    const server = mockApi({ "POST /quickbooks/sync/doc-1": { json: {} } });
    await expect(api.syncToQuickBooks("doc-1")).resolves.toBeUndefined();

    server.set({
      "POST /quickbooks/sync/doc-1": { status: 400, json: { detail: "QuickBooks token expired" } },
    });
    await expect(api.syncToQuickBooks("doc-1")).rejects.toThrow("QuickBooks token expired");

    server.set({ "POST /quickbooks/sync/doc-1": { status: 500, body: "" } });
    await expect(api.syncToQuickBooks("doc-1")).rejects.toThrow("Failed to sync to QuickBooks");
  });

  it("disconnects and surfaces failures", async () => {
    const server = mockApi({ "DELETE /quickbooks/disconnect": { json: {} } });
    await expect(api.disconnectQuickBooks()).resolves.toBeUndefined();

    server.set({
      "DELETE /quickbooks/disconnect": { status: 500, json: { detail: "Intuit unavailable" } },
    });
    await expect(api.disconnectQuickBooks()).rejects.toThrow("Intuit unavailable");

    server.set({ "DELETE /quickbooks/disconnect": { status: 500, body: "" } });
    await expect(api.disconnectQuickBooks()).rejects.toThrow("Failed to disconnect QuickBooks");
  });

  it("treats an unreadable sync status as not synced", async () => {
    const server = mockApi({ "GET /quickbooks/sync-status/doc-1": { json: { synced: true } } });
    await expect(api.checkQuickBooksSyncStatus("doc-1")).resolves.toEqual({ synced: true });

    server.set({ "GET /quickbooks/sync-status/doc-1": { status: 500 } });
    await expect(api.checkQuickBooksSyncStatus("doc-1")).resolves.toEqual({ synced: false });
  });
});

describe("password reset", () => {
  it("requests a reset link without authentication", async () => {
    const server = mockApi({ "POST /auth/forgot-password": { json: {} } });
    await api.requestPasswordReset("ada@example.com");
    expect(server.requests[0].headers.get("Authorization")).toBeNull();
    expect(server.requests[0].body).toEqual({ email: "ada@example.com" });

    server.set({ "POST /auth/forgot-password": { status: 500 } });
    await expect(api.requestPasswordReset("ada@example.com")).rejects.toThrow(
      "Failed to request reset"
    );
  });

  it("resets the password with the emailed token", async () => {
    const server = mockApi({ "POST /auth/reset-password": { json: { message: "ok" } } });
    await api.resetPassword("tok-123", "NewSecret1");
    expect(server.requests[0].body).toEqual({ token: "tok-123", new_password: "NewSecret1" });

    server.set({
      "POST /auth/reset-password": { status: 400, json: { detail: "Reset link expired" } },
    });
    await expect(api.resetPassword("tok-123", "NewSecret1")).rejects.toThrow("Reset link expired");

    server.set({ "POST /auth/reset-password": { status: 500, body: "" } });
    await expect(api.resetPassword("tok-123", "NewSecret1")).rejects.toThrow(
      "Failed to reset password"
    );
  });
});

describe("settings", () => {
  beforeEach(() => {
    signIn();
  });

  it("reads and updates the base currency", async () => {
    const settings = {
      id: "u1",
      username: "ada@example.com",
      plan: "free",
      base_currency: "EUR",
      created_at: "2026-01-01",
    };
    const server = mockApi({
      "GET /auth/settings": { json: settings },
      "PATCH /auth/settings": { json: { ...settings, base_currency: "GBP" } },
    });

    await expect(api.getSettings()).resolves.toMatchObject({ base_currency: "EUR" });
    await expect(api.updateSettings("GBP")).resolves.toMatchObject({ base_currency: "GBP" });
    expect(server.callsTo("PATCH /auth/settings")[0].body).toEqual({ base_currency: "GBP" });
  });

  it("surfaces update failures", async () => {
    const server = mockApi({
      "GET /auth/settings": { status: 500 },
      "PATCH /auth/settings": { status: 422, json: { detail: "Unsupported currency" } },
    });
    await expect(api.getSettings()).rejects.toThrow("Failed to fetch settings");
    await expect(api.updateSettings("XXX")).rejects.toThrow("Unsupported currency");

    server.set({ "PATCH /auth/settings": { status: 500, body: "" } });
    await expect(api.updateSettings("XXX")).rejects.toThrow("Failed to update settings");
  });
});
