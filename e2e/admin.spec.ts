import { test, expect, accountRoutes, makeToken } from "./support/fixtures";

// Admins and customers are separate account types with separate app surfaces. These journeys run
// against the production build with the backend mocked (see support/fixtures.ts).

const OVERVIEW = {
  users: { total: 42, pro: 10, free: 32, suspended: 1, active_last_7d: 20, signups_today: 2, signups_last_7d: 9, signups_last_30d: 30 },
  admins: { total: 1 },
  deleted_accounts: { total: 5, last_30d: 2, self_service_last_30d: 2, with_subscription_last_30d: 0 },
  documents: { total: 300, by_status: { COMPLETED: 290, FAILED: 10 }, created_today: 6, created_last_7d: 40, flagged: 2, avg_confidence: 0.91 },
  billing: { active_subscriptions: 9, past_due: 1, canceling_at_period_end: 1, comped_pro: 1, estimated_mrr_usd: 45, price_per_seat_usd: 5 },
  integrations: { quickbooks_connections: 3 },
  vendors: { total: 120 },
  feedback: { total: 12, new: 3, open_bugs: 2 },
  contact: { total: 8, new: 4 },
};

const ANALYTICS = {
  days: 30,
  series: [
    { date: "2026-10-23", signups: 1, deletions: 0, documents: 4, failed: 0, feedback: 1, contact: 0 },
    { date: "2026-10-24", signups: 2, deletions: 1, documents: 6, failed: 1, feedback: 0, contact: 1 },
  ],
  totals: { signups: 3, deletions: 1, documents: 10, failed: 1, failure_rate: 0.1, previous_signups: 2, previous_documents: 8 },
  plans: [{ name: "free", value: 32 }, { name: "pro", value: 10 }],
  document_statuses: [{ name: "COMPLETED", value: 9 }, { name: "FAILED", value: 1 }],
  categories: [{ name: "Software", value: 5 }],
  currencies: [{ name: "USD", value: 9 }],
  top_uploaders: [{ id: "u1", username: "ada@example.com", plan: "pro", documents: 7 }],
  feedback_types: [{ name: "Bug", value: 1 }],
};

const adminToken = () => makeToken({ sub: "admin@tallyhawk.test", role: "admin", plan: undefined });
const adminRoutes = {
  "GET /admin/overview": { json: OVERVIEW },
  "GET /admin/analytics": { json: ANALYTICS },
};

test.describe("admin dashboard", () => {
  test("an admin who signs in lands on the admin overview, not the customer app", async ({ page, api }) => {
    api.set({
      ...adminRoutes,
      "POST /auth/login": { json: { access_token: adminToken(), token_type: "bearer", role: "admin" } },
    });

    await page.goto("/login");
    await page.getByLabel("Email address").fill("admin@tallyhawk.test");
    await page.getByLabel("Password", { exact: true }).fill("Admin-pass1");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
    await expect(page.getByText("$45")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Main" }).getByText("Admin", { exact: true })).toBeVisible();
    // No customer requests (billing, settings, documents) are ever made for an admin.
    expect(api.requests.filter((r) => !r.path.startsWith("/admin") && r.path !== "/auth/login")).toEqual([]);
  });

  test("an admin who opens a customer page is sent back to the admin dashboard", async ({ page, api, signIn }) => {
    await signIn({ sub: "admin@tallyhawk.test", role: "admin", plan: undefined });
    api.set(adminRoutes);
    await page.goto("/app");
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
  });

  test("a customer who opens the admin dashboard is sent to their own dashboard", async ({ page, api, signIn }) => {
    await signIn();
    api.set(accountRoutes());
    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByRole("heading", { level: 1, name: "Documents" })).toBeVisible();
    expect(api.requests.filter((r) => r.path.startsWith("/admin"))).toEqual([]);
  });

  test("signed-out visitors are asked to log in", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("an admin finds a customer and suspends them", async ({ page, api, signIn }) => {
    await signIn({ sub: "admin@tallyhawk.test", role: "admin", plan: undefined });
    let status = "active";
    const detail = () => ({
      id: "u1",
      username: "ada@example.com",
      role: "user",
      status,
      plan: "free",
      base_currency: "USD",
      created_at: "2026-01-01T00:00:00Z",
      last_login_at: null,
      usage: { documents_processed_this_month: 2, limit: 10 },
      documents: { total: 0, by_status: {}, recent: [] },
      subscription: null,
      vendors: 0,
      quickbooks_connected: false,
      feedback_count: 0,
      contact_count: 0,
    });
    api.set({
      "GET /admin/users": {
        json: {
          total: 1,
          limit: 25,
          offset: 0,
          results: [{ id: "u1", username: "ada@example.com", plan: "free", status: "active", created_at: "2026-01-01T00:00:00Z", last_login_at: null, document_count: 0, subscription_status: null, cancel_at_period_end: false }],
        },
      },
      "GET /admin/users/u1": () => ({ json: detail() }),
      "PATCH /admin/users/u1": (req) => {
        status = (req.body as { status: string }).status;
        return { json: detail() };
      },
    });
    page.on("dialog", (dialog) => dialog.accept());

    await page.goto("/admin/users");
    await page.getByRole("link", { name: "ada@example.com" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "ada@example.com" })).toBeVisible();
    await page.getByRole("button", { name: "Suspend" }).click();
    await expect(page.getByText("Account suspended and signed out everywhere.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Reactivate" })).toBeVisible();
    expect(api.calls("PATCH /admin/users/u1")[0].body).toEqual({ status: "suspended" });
  });

  test("the contact form delivers to the admin inbox", async ({ page, api }) => {
    api.set({ "POST /contact": { status: 201, json: { status: "success" } } });
    await page.goto("/contact");
    await page.getByRole("textbox", { name: "Name", exact: true }).fill("Ada Lovelace");
    await page.getByRole("textbox", { name: "Email", exact: true }).fill("ada@example.com");
    await page.getByRole("textbox", { name: "Subject", exact: true }).fill("Billing");
    await page.getByRole("textbox", { name: "Message", exact: true }).fill("Can I get an invoice for last month?");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Thanks, your message is on its way." })).toBeVisible();
    expect(api.calls("POST /contact")[0].body).toMatchObject({ email: "ada@example.com", website: "" });
  });
});
