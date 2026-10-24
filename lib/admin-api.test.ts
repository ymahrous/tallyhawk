import { beforeEach, describe, expect, it } from "vitest";
import * as admin from "./admin-api";
import { mockApi } from "@/test/api-mock";
import { signIn } from "@/test/auth";

beforeEach(() => {
  signIn({ role: "admin" });
});

const PAGE = { total: 0, limit: 25, offset: 0, results: [] };

describe("admin API client", () => {
  it("reads every admin view with the session token and only the filters that are set", async () => {
    const server = mockApi({
      "GET /admin/me": { json: { username: "admin@tallyhawk.test" } },
      "GET /admin/overview": { json: { users: { total: 1 } } },
      "GET /admin/analytics": { json: { days: 30 } },
      "GET /admin/users": { json: PAGE },
      "GET /admin/users/u%201": { json: { id: "u 1" } },
      "GET /admin/admins": { json: [] },
      "GET /admin/feedback": { json: { ...PAGE, status_counts: {} } },
      "GET /admin/contact": { json: { ...PAGE, status_counts: {} } },
      "GET /admin/documents": { json: PAGE },
      "GET /admin/audit-log": { json: PAGE },
    });

    await admin.getAdminMe();
    await admin.getAdminOverview();
    await admin.getAdminAnalytics(30);
    await admin.listAdminUsers({ plan: "pro", search: "", status: undefined, offset: 0, sort: "documents" });
    await admin.getAdminUser("u 1");
    await admin.listAdmins();
    await admin.listAdminFeedback({ type: "Bug", status: "new" });
    await admin.listAdminContact({ search: "refund" });
    await admin.listAdminDocuments({ flagged: false, status: "FAILED" });
    await admin.getAuditLog({ area: "user", limit: 50 });

    const search = (path: string) => server.callsTo(`GET ${path}`)[0].url.search;
    expect(search("/admin/analytics")).toBe("?days=30");
    expect(search("/admin/users")).toBe("?plan=pro&offset=0&sort=documents");
    expect(search("/admin/feedback")).toBe("?type=Bug&status=new");
    expect(search("/admin/documents")).toBe("?status=FAILED");
    expect(search("/admin/audit-log")).toBe("?area=user&limit=50");
    expect(server.requests.every((r) => r.headers.get("Authorization")?.startsWith("Bearer "))).toBe(true);
  });

  it("sends every admin write with the right method and body", async () => {
    const server = mockApi({
      "PATCH /admin/users/u1": { json: {} },
      "DELETE /admin/users/u1": { status: 204 },
      "POST /admin/users/u1/sign-out": { status: 204 },
      "POST /admin/users/u1/password-reset": { json: { message: "sent" } },
      "POST /admin/admins": { status: 201, json: {} },
      "PATCH /admin/admins/a1": { json: {} },
      "DELETE /admin/admins/a1": { status: 204 },
      "PATCH /admin/feedback/f1": { json: {} },
      "DELETE /admin/feedback/f1": { status: 204 },
      "PATCH /admin/contact/c1": { json: {} },
      "DELETE /admin/contact/c1": { status: 204 },
      "POST /admin/documents/d1/reprocess": { json: { status: "PENDING" } },
    });

    await admin.updateAdminUser("u1", { plan: "pro" });
    await expect(admin.deleteAdminUser("u1")).resolves.toBeUndefined();
    await admin.signOutAdminUser("u1");
    await expect(admin.sendAdminUserPasswordReset("u1")).resolves.toEqual({ message: "sent" });
    await admin.createAdminAccount("new@tallyhawk.test", "Second-admin1");
    await admin.updateAdminAccount("a1", "suspended");
    await admin.deleteAdminAccount("a1");
    await admin.updateAdminFeedback("f1", { status: "resolved", admin_note: "done" });
    await admin.deleteAdminFeedback("f1");
    await admin.updateAdminContact("c1", { status: "archived" });
    await admin.deleteAdminContact("c1");
    await admin.reprocessAdminDocument("d1");

    expect(server.callsTo("PATCH /admin/users/u1")[0].body).toEqual({ plan: "pro" });
    expect(server.callsTo("POST /admin/admins")[0].body).toEqual({ username: "new@tallyhawk.test", password: "Second-admin1" });
    expect(server.callsTo("PATCH /admin/admins/a1")[0].body).toEqual({ status: "suspended" });
    expect(server.callsTo("PATCH /admin/feedback/f1")[0].body).toEqual({ status: "resolved", admin_note: "done" });
    expect(server.callsTo("PATCH /admin/contact/c1")[0].body).toEqual({ status: "archived" });
  });

  it("surfaces the server's message, with a fallback", async () => {
    mockApi({
      "GET /admin/overview": { status: 403, json: { detail: "Admin access required." } },
      "DELETE /admin/admins/a1": { status: 400, json: { detail: "You can't delete your own admin account." } },
      "GET /admin/users": { status: 500, body: "" },
    });
    await expect(admin.getAdminOverview()).rejects.toThrow("Admin access required.");
    await expect(admin.deleteAdminAccount("a1")).rejects.toThrow("You can't delete your own admin account.");
    await expect(admin.listAdminUsers()).rejects.toThrow("Failed to load users");
  });

  it("signs out on an expired admin session", async () => {
    mockApi({ "GET /admin/overview": { status: 401, json: { detail: "Session expired. Please log in again." } } });
    await expect(admin.getAdminOverview()).rejects.toThrow("Session expired");
    expect(localStorage.getItem("token")).toBeNull();
  });
});
