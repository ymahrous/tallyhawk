import { describe, it, expect, vi, beforeEach } from "vitest";
import { cloneElement, isValidElement, type ReactElement } from "react";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminLayout from "./layout";
import AdminOverviewPage from "./page";
import AdminUsersPage from "./users/page";
import AdminUserPage from "./users/[userId]/page";
import AdminAdminsPage from "./admins/page";
import AdminContactPage from "./contact/page";
import AdminFeedbackPage from "./feedback/page";
import AdminDocumentsPage from "./documents/page";
import AdminAuditPage from "./audit/page";
import AdminDeletedAccountsPage from "./deleted-accounts/page";
import AdminAccountPage from "./account/page";
import { renderWithProviders } from "@/test/render";
import { mockApi, type Routes } from "@/test/api-mock";
import { router, setParams, setPathname, setSearchParams } from "@/test/navigation";
import { makeToken, signIn } from "@/test/auth";

// ResponsiveContainer measures its parent, which is 0×0 in jsdom; give charts a fixed size.
vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactElement }) =>
      isValidElement(children) ? cloneElement(children as ReactElement<{ width: number; height: number }>, { width: 800, height: 300 }) : null,
  };
});

beforeEach(() => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

const page = <T,>(results: T[], extra: object = {}) => ({ total: results.length, limit: 25, offset: 0, results, ...extra });

function asAdmin(routes: Routes = {}) {
  signIn({ role: "admin", sub: "admin@tallyhawk.test", plan: undefined });
  return mockApi(routes);
}

const OVERVIEW = {
  users: { total: 120, pro: 30, free: 90, suspended: 2, active_last_7d: 40, signups_today: 3, signups_last_7d: 12, signups_last_30d: 50 },
  admins: { total: 2 },
  deleted_accounts: { total: 11, last_30d: 4, self_service_last_30d: 3, with_subscription_last_30d: 1 },
  documents: { total: 900, by_status: { COMPLETED: 880, FAILED: 20 }, created_today: 15, created_last_7d: 100, flagged: 4, avg_confidence: 0.934 },
  billing: { active_subscriptions: 28, past_due: 1, canceling_at_period_end: 3, comped_pro: 2, estimated_mrr_usd: 140, price_per_seat_usd: 5 },
  integrations: { quickbooks_connections: 9 },
  vendors: { total: 300 },
  feedback: { total: 40, new: 6, open_bugs: 5 },
  contact: { total: 25, new: 7 },
};

const analytics = (days: number) => ({
  days,
  series: [
    { date: "2026-10-23", signups: 2, deletions: 0, documents: 10, failed: 1, feedback: 1, contact: 0 },
    { date: "2026-10-24", signups: 3, deletions: 1, documents: 15, failed: 0, feedback: 0, contact: 2 },
  ],
  totals: { signups: 5, deletions: 1, documents: 25, failed: 1, failure_rate: 0.04, previous_signups: 4, previous_documents: 0 },
  plans: [{ name: "free", value: 90 }, { name: "pro", value: 30 }],
  document_statuses: [{ name: "COMPLETED", value: 24 }],
  categories: [{ name: "Travel", value: 12 }],
  currencies: [{ name: "USD", value: 20 }],
  top_uploaders: [{ id: "u1", username: "ada@example.com", plan: "pro", documents: 14 }],
  feedback_types: [],
});

describe("admin shell", () => {
  it("sends signed-out visitors to log in and customers to their own dashboard", () => {
    mockApi();
    const { container } = renderWithProviders(<AdminLayout><p>secret</p></AdminLayout>);
    expect(router.push).toHaveBeenCalledWith("/login");
    expect(container).not.toHaveTextContent("secret");

    signIn({ plan: "pro" });
    renderWithProviders(<AdminLayout><p>secret</p></AdminLayout>);
    expect(router.replace).toHaveBeenCalledWith("/app");
    expect(screen.queryByText("secret")).toBeNull();
  });

  it("renders admin pages inside the section navigation", () => {
    asAdmin();
    setPathname("/admin/users/u1");
    renderWithProviders(<AdminLayout><p>content</p></AdminLayout>);
    expect(screen.getByText("content")).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Admin sections" });
    expect(within(nav).getByRole("link", { name: "Customers" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current");
  });
});

describe("overview", () => {
  it("shows headline numbers, period comparisons, charts and top uploaders, and changes the range", async () => {
    const server = asAdmin({
      "GET /admin/overview": { json: OVERVIEW },
      "GET /admin/analytics": (req) => ({ json: analytics(Number(req.url.searchParams.get("days"))) }),
    });
    renderWithProviders(<AdminOverviewPage />);

    expect(await screen.findByText("120")).toBeInTheDocument();
    expect(screen.getByText("$140")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "7" })).toHaveAttribute("href", "/admin/contact");
    expect(screen.getByRole("link", { name: "5" })).toHaveAttribute("href", "/admin/feedback?type=Bug");
    expect(screen.getByRole("link", { name: "4" })).toHaveAttribute("href", "/admin/deleted-accounts");
    expect(screen.getByText("1 had a subscription · 11 all time · 2 suspended")).toBeInTheDocument();
    expect(await screen.findByText("+25% vs previous 30 days · 1 deleted")).toBeInTheDocument();
    expect(screen.getByRole("figure", { name: "Signups and deletions per day" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ada@example.com" })).toHaveAttribute("href", "/admin/users/u1");
    expect(screen.getAllByText("View as table").length).toBeGreaterThan(3);

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Analytics range" }), "90");
    await waitFor(() => expect(server.callsTo("GET /admin/analytics").at(-1)!.url.search).toBe("?days=90"));
  });

  it("explains a failed load", async () => {
    asAdmin({ "GET /admin/overview": { status: 500, json: { detail: "Database unavailable" } }, "GET /admin/analytics": { status: 500 } });
    renderWithProviders(<AdminOverviewPage />);
    expect(await screen.findByText("Database unavailable")).toBeInTheDocument();
    expect(await screen.findByText("Failed to load analytics")).toBeInTheDocument();
  });
});

describe("customers", () => {
  const ROW = { id: "u1", username: "ada@example.com", plan: "pro", status: "active", created_at: "2026-01-01T00:00:00Z", last_login_at: null, document_count: 4, subscription_status: "past_due", cancel_at_period_end: true };

  it("lists, searches, filters, sorts and pages customers", async () => {
    const server = asAdmin({ "GET /admin/users": (req) => ({ json: { ...page([ROW]), total: req.url.searchParams.get("offset") ? 30 : 30 } }) });
    renderWithProviders(<AdminUsersPage />);

    expect(await screen.findByRole("link", { name: "ada@example.com" })).toHaveAttribute("href", "/admin/users/u1");
    expect(screen.getByText("past due")).toBeInTheDocument();
    expect(screen.getByText("canceling")).toBeInTheDocument();

    await userEvent.type(screen.getByRole("searchbox", { name: "Search customers" }), "ada{Enter}");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Plan" }), "pro");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Sort" }), "documents:desc");
    await waitFor(() => expect(server.callsTo("GET /admin/users").at(-1)!.url.search).toBe("?sort=documents&order=desc&offset=0&search=ada&plan=pro&limit=25"));

    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(server.callsTo("GET /admin/users").at(-1)!.url.searchParams.get("offset")).toBe("25"));
  });

  const DETAIL = {
    id: "u1",
    username: "ada@example.com",
    role: "user",
    status: "active",
    plan: "free",
    base_currency: "USD",
    created_at: "2026-01-01T00:00:00Z",
    last_login_at: "2026-10-20T10:00:00Z",
    usage: { documents_processed_this_month: 3, limit: 10 },
    documents: { total: 1, by_status: { COMPLETED: 1 }, recent: [{ id: "d1", filename: "receipt.pdf", status: "COMPLETED", flags: null, quickbooks_synced: false, created_at: "2026-10-01T00:00:00Z" }] },
    subscription: null,
    vendors: 2,
    quickbooks_connected: false,
    feedback_count: 1,
    contact_count: 0,
  };

  it("shows a customer and runs every admin action on them", async () => {
    setParams({ userId: "u1" });
    let detail = { ...DETAIL };
    const server = asAdmin({
      "GET /admin/users/u1": () => ({ json: detail }),
      "PATCH /admin/users/u1": (req) => {
        detail = { ...detail, ...(req.body as object) };
        return { json: detail };
      },
      "POST /admin/users/u1/sign-out": { status: 204 },
      "POST /admin/users/u1/password-reset": { json: { message: "A password-reset link was sent to ada@example.com." } },
      "DELETE /admin/users/u1": { status: 204 },
    });
    renderWithProviders(<AdminUserPage />);

    expect(await screen.findByRole("heading", { level: 1, name: "ada@example.com" })).toBeInTheDocument();
    expect(screen.getByText("3 / 10")).toBeInTheDocument();
    expect(screen.getByText("receipt.pdf")).toBeInTheDocument();
    expect(screen.getByText("No Stripe subscription.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Grant Pro" }));
    expect(await screen.findByText("Pro granted.")).toBeInTheDocument();
    expect(server.callsTo("PATCH /admin/users/u1")[0].body).toEqual({ plan: "pro" });

    await userEvent.click(await screen.findByRole("button", { name: "Suspend" }));
    expect(await screen.findByText("Account suspended and signed out everywhere.")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Reactivate" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Sign out everywhere" }));
    expect(await screen.findByText("Signed out of every session.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Email password reset" }));
    expect(await screen.findByText("A password-reset link was sent to ada@example.com.")).toBeInTheDocument();

    const del = screen.getByRole("button", { name: "Delete customer" });
    expect(del).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/to confirm/), "ada@example.com");
    await userEvent.click(del);
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/admin/users"));
  });

  it("warns before revoking Pro from someone Stripe still bills, and shows action errors", async () => {
    setParams({ userId: "u1" });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    asAdmin({
      "GET /admin/users/u1": {
        json: { ...DETAIL, plan: "pro", subscription: { status: "active", current_period_end: "2026-11-01T00:00:00Z", cancel_at_period_end: false, stripe_customer_id: "cus_1", stripe_subscription_id: "sub_1" } },
      },
      "POST /admin/users/u1/password-reset": { status: 429, json: { detail: "Too many requests. Please try again later." } },
    });
    renderWithProviders(<AdminUserPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Revoke Pro" }));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("live Stripe subscription"));
    expect(screen.getByText("cus_1")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Email password reset" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Too many requests");
  });
});

describe("admins", () => {
  const ADMINS = [
    { id: "a1", username: "admin@tallyhawk.test", role: "admin", status: "active", plan: null, base_currency: null, created_at: "2026-01-01T00:00:00Z", last_login_at: null, is_you: true },
    { id: "a2", username: "ops@tallyhawk.test", role: "admin", status: "active", plan: null, base_currency: null, created_at: "2026-02-01T00:00:00Z", last_login_at: null, is_you: false },
  ];

  it("creates admins, validating first, and suspends or deletes others but never yourself", async () => {
    const server = asAdmin({
      "GET /admin/admins": { json: ADMINS },
      "POST /admin/admins": { status: 201, json: { ...ADMINS[1], id: "a3", username: "new@tallyhawk.test" } },
      "PATCH /admin/admins/a2": { json: { ...ADMINS[1], status: "suspended" } },
      "DELETE /admin/admins/a2": { status: 204 },
    });
    renderWithProviders(<AdminAdminsPage />);

    const mine = (await screen.findByText("admin@tallyhawk.test")).closest("tr")!;
    expect(within(mine).queryByRole("button")).toBeNull();
    expect(within(mine).getByText("(you)")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Email"), "new@tallyhawk.test");
    await userEvent.type(screen.getByLabelText("Initial password"), "weak");
    await userEvent.click(screen.getByRole("button", { name: "Create admin" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Password must be at least 8 characters.");
    expect(server.callsTo("POST /admin/admins")).toEqual([]);

    await userEvent.clear(screen.getByLabelText("Initial password"));
    await userEvent.type(screen.getByLabelText("Initial password"), "Second-admin1");
    await userEvent.click(screen.getByRole("button", { name: "Create admin" }));
    expect(await screen.findByText(/Admin new@tallyhawk.test created/)).toBeInTheDocument();
    expect(server.callsTo("POST /admin/admins")[0].body).toEqual({ username: "new@tallyhawk.test", password: "Second-admin1" });

    const other = screen.getByText("ops@tallyhawk.test").closest("tr")!;
    await userEvent.click(within(other).getByRole("button", { name: "Suspend" }));
    await waitFor(() => expect(server.callsTo("PATCH /admin/admins/a2")[0].body).toEqual({ status: "suspended" }));
    await userEvent.click(within(screen.getByText("ops@tallyhawk.test").closest("tr")!).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(server.callsTo("DELETE /admin/admins/a2")).toHaveLength(1));
  });

  it("shows the server's refusal", async () => {
    asAdmin({ "GET /admin/admins": { json: ADMINS }, "DELETE /admin/admins/a2": { status: 400, json: { detail: "Nope." } } });
    renderWithProviders(<AdminAdminsPage />);
    await userEvent.click(within((await screen.findByText("ops@tallyhawk.test")).closest("tr")!).getByRole("button", { name: "Delete" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Nope.");
  });
});

describe("support inboxes", () => {
  const MESSAGE = { id: "c1", name: "Ada", email: "ada@example.com", subject: "Refund", message: "Please <b>refund</b> me", status: "new", admin_note: null, user_id: "u1", created_at: "2026-10-01T00:00:00Z", updated_at: null };

  it("shows new contact messages first, expands one, triages it, notes it and deletes it", async () => {
    const server = asAdmin({
      "GET /admin/contact": { json: page([MESSAGE], { status_counts: { new: 1, resolved: 4 } }) },
      "PATCH /admin/contact/c1": (req) => ({ json: { ...MESSAGE, ...(req.body as object) } }),
      "DELETE /admin/contact/c1": { status: 204 },
    });
    renderWithProviders(<AdminContactPage />);

    expect(await screen.findByRole("button", { name: "New (1)" })).toHaveAttribute("aria-pressed", "true");
    expect(server.callsTo("GET /admin/contact")[0].url.searchParams.get("status")).toBe("new");
    expect(screen.getByRole("button", { name: "All (5)" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Refund — Ada/ }));
    // Shown as text, never as HTML.
    expect(screen.getByText("Please <b>refund</b> me")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Reply by email" })).toHaveAttribute("href", expect.stringMatching(/^mailto:ada%40example\.com\?subject=Re%3A%20Refund$/));
    expect(screen.getByRole("link", { name: "customer account" })).toHaveAttribute("href", "/admin/users/u1");

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Status" }), "resolved");
    await waitFor(() => expect(server.callsTo("PATCH /admin/contact/c1")[0].body).toEqual({ status: "resolved" }));

    await userEvent.type(screen.getByLabelText("Internal note (admins only)"), "Refunded");
    await userEvent.click(screen.getByRole("button", { name: "Save note" }));
    await waitFor(() => expect(server.callsTo("PATCH /admin/contact/c1")[1].body).toEqual({ admin_note: "Refunded" }));

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(server.callsTo("DELETE /admin/contact/c1")).toHaveLength(1));

    await userEvent.click(screen.getByRole("button", { name: "All (5)" }));
    await waitFor(() => expect(server.callsTo("GET /admin/contact").at(-1)!.url.searchParams.get("status")).toBeNull());
  });

  it("opens bug reports from the overview link and filters feedback by type", async () => {
    setSearchParams({ type: "Bug" });
    const bug = { id: "f1", type: "Bug", message: "Upload stuck", page: "/app", status: "in_progress", admin_note: "Looking", created_at: "2026-10-01T00:00:00Z", updated_at: null, user_id: null, username: null };
    const server = asAdmin({
      "GET /admin/feedback": { json: page([bug], { status_counts: { in_progress: 1 } }) },
      "PATCH /admin/feedback/f1": { status: 500, json: { detail: "Couldn't save." } },
    });
    renderWithProviders(<AdminFeedbackPage />);

    expect(await screen.findByRole("combobox", { name: "Type" })).toHaveValue("Bug");
    expect(server.callsTo("GET /admin/feedback")[0].url.searchParams.get("type")).toBe("Bug");
    await userEvent.click(screen.getAllByText("Upload stuck")[0]);
    expect(screen.getByText(/From a signed-out visitor/)).toBeInTheDocument();
    expect(screen.getByText("/app")).toBeInTheDocument();
    expect(screen.getByLabelText("Internal note (admins only)")).toHaveValue("Looking");

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Status" }), "resolved");
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't save.");

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Type" }), "");
    await waitFor(() => expect(server.callsTo("GET /admin/feedback").at(-1)!.url.searchParams.get("type")).toBeNull());
  });
});

describe("documents and audit log", () => {
  it("offers reprocessing for failed and stuck documents only", async () => {
    const docs = [
      { id: "d1", filename: "broken.pdf", status: "FAILED", flags: null, quickbooks_synced: false, created_at: new Date().toISOString(), owner_id: "u1", owner_username: "ada@example.com" },
      { id: "d2", filename: "stuck.pdf", status: "PROCESSING", flags: null, quickbooks_synced: false, created_at: "2026-01-01T00:00:00Z", owner_id: "u1", owner_username: "ada@example.com" },
      { id: "d3", filename: "fine.pdf", status: "COMPLETED", flags: "duplicate", quickbooks_synced: true, created_at: "2026-01-01T00:00:00Z", owner_id: "u1", owner_username: "ada@example.com" },
    ];
    const server = asAdmin({ "GET /admin/documents": { json: page(docs) }, "POST /admin/documents/d1/reprocess": { json: { status: "PENDING" } } });
    renderWithProviders(<AdminDocumentsPage />);

    await screen.findByText("broken.pdf");
    expect(screen.getAllByRole("button", { name: "Reprocess" })).toHaveLength(2);
    expect(screen.getByText("duplicate")).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("button", { name: "Reprocess" })[0]);
    expect(await screen.findByText(/Reprocessing broken.pdf/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("checkbox", { name: "Flagged only" }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Status" }), "FAILED");
    await waitFor(() => expect(server.callsTo("GET /admin/documents").at(-1)!.url.search).toBe("?offset=0&flagged=true&status=FAILED&limit=25"));
  });

  it("lists admin actions and filters by area", async () => {
    const entry = { id: "e1", actor_id: "a1", actor_username: "admin@tallyhawk.test", action: "user.update", target_type: "user", target_id: "u1", target_label: "ada@example.com", details: { plan: { from: "free", to: "pro" } }, created_at: "2026-10-01T00:00:00Z" };
    const anonymized = { ...entry, id: "e2", action: "user.delete", target_id: null, target_label: null, details: null };
    const server = asAdmin({ "GET /admin/audit-log": { json: page([entry, anonymized]) } });
    renderWithProviders(<AdminAuditPage />);
    expect(await screen.findByText("User update")).toBeInTheDocument();
    expect(within(screen.getByText("User delete").closest("tr")!).getByText("Anonymized")).toBeInTheDocument();
    expect(screen.getByText('{"plan":{"from":"free","to":"pro"}}')).toBeInTheDocument();
    expect(screen.getByText(/Targets and IP hashes are removed after 365 days/)).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Area" }), "admin");
    await waitFor(() => expect(server.callsTo("GET /admin/audit-log").at(-1)!.url.searchParams.get("area")).toBe("admin"));
  });
});

describe("deleted accounts", () => {
  const RECORDS = [
    {
      id: "d1",
      user_id: "u-pro",
      username: "pro@example.com",
      role: "user",
      plan: "pro",
      account_created_at: "2026-01-01T00:00:00Z",
      deleted_at: "2026-10-20T12:00:00Z",
      deleted_by: "admin",
      deleted_by_admin_id: "a1",
      deleted_by_admin_username: "admin@tallyhawk.test",
      lifetime_documents: 40,
      subscription: { stripe_customer_id: "cus_9", stripe_subscription_id: "sub_9", status_at_deletion: "active", status: "canceled", current_period_end: null, billing_cancelled_at: "2026-10-20T12:00:00Z" },
    },
    {
      id: "d2",
      user_id: "u-late",
      username: "late@example.com",
      role: "user",
      plan: "free",
      account_created_at: null,
      deleted_at: "2026-10-19T12:00:00Z",
      deleted_by: "self",
      deleted_by_admin_id: null,
      deleted_by_admin_username: null,
      lifetime_documents: 2,
      subscription: { stripe_customer_id: "cus_7", stripe_subscription_id: "sub_7", status_at_deletion: null, status: "active", current_period_end: null, billing_cancelled_at: null },
    },
    { id: "d3", user_id: "a-x", username: "ex-admin@tallyhawk.test", role: "admin", plan: null, account_created_at: null, anonymized_at: null, deleted_at: "2026-10-18T12:00:00Z", deleted_by: "admin", deleted_by_admin_id: "a1", deleted_by_admin_username: null, lifetime_documents: 0, subscription: null },
    {
      id: "d4",
      user_id: null,
      username: null,
      role: "user",
      plan: "pro",
      account_created_at: null,
      anonymized_at: "2026-05-01T12:00:00Z",
      deleted_at: "2026-01-01T12:00:00Z",
      deleted_by: "self",
      deleted_by_admin_id: null,
      deleted_by_admin_username: null,
      lifetime_documents: 1,
      subscription: { stripe_customer_id: null, stripe_subscription_id: null, status_at_deletion: "active", status: "canceled", current_period_end: null, billing_cancelled_at: "2026-01-01T12:00:00Z" },
    },
  ];

  it("shows who was deleted, by whom, and what happened to their subscription, with filters", async () => {
    const server = asAdmin({ "GET /admin/deleted-accounts": { json: page(RECORDS) } });
    renderWithProviders(<AdminDeletedAccountsPage />);

    const pro = (await screen.findByText("pro@example.com")).closest("tr")!;
    expect(within(pro).getByText("By admin@tallyhawk.test")).toBeInTheDocument();
    expect(within(pro).getByText("active at deletion")).toBeInTheDocument();
    expect(within(pro).getByText("now canceled")).toBeInTheDocument();
    expect(within(pro).getByText(/Billing stopped/)).toBeInTheDocument();
    expect(within(pro).getByText("cus_9 · sub_9")).toBeInTheDocument();

    // A subscription still able to bill a deleted account stands out.
    const late = screen.getByText("late@example.com").closest("tr")!;
    expect(within(late).getByText("By themselves")).toBeInTheDocument();
    expect(within(late).getByText("still active")).toBeInTheDocument();

    const exAdmin = screen.getByText("ex-admin@tallyhawk.test").closest("tr")!;
    expect(within(exAdmin).getByText("admin")).toBeInTheDocument();
    expect(within(exAdmin).getByText("None")).toBeInTheDocument();
    expect(within(exAdmin).getByText("By an admin")).toBeInTheDocument();

    // Past the retention period only the anonymized facts are left: no email, ids or Stripe ids.
    const gone = screen.getByText("Anonymized (retention)").closest("tr")!;
    expect(within(gone).getByText("active at deletion")).toBeInTheDocument();
    expect(within(gone).queryByText(/cus_|sub_/)).toBeNull();
    expect(screen.getByText(/Emails, former ids and Stripe ids are removed 120 days after deletion; the anonymized record stays/)).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Deleted by" }), "self");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Account type" }), "user");
    await userEvent.click(screen.getByRole("checkbox", { name: "Had a subscription" }));
    await userEvent.type(screen.getByRole("searchbox", { name: "Search deleted accounts" }), "sub_7{Enter}");
    await waitFor(() =>
      expect(server.callsTo("GET /admin/deleted-accounts").at(-1)!.url.search).toBe("?offset=0&deleted_by=self&role=user&subscription=true&search=sub_7&limit=25")
    );
  });

  it("explains an empty list", async () => {
    asAdmin({ "GET /admin/deleted-accounts": { json: page([]) } });
    renderWithProviders(<AdminDeletedAccountsPage />);
    expect(await screen.findByText("No deleted accounts match.")).toBeInTheDocument();
  });
});

describe("admin account", () => {
  it("shows the admin's profile and changes their password, keeping this session", async () => {
    const fresh = makeToken({ role: "admin", ver: 1 });
    const server = asAdmin({
      "GET /admin/me": { json: { id: "a1", username: "admin@tallyhawk.test", role: "admin", status: "active", plan: null, base_currency: null, created_at: "2026-01-01T00:00:00Z", last_login_at: null } },
      "POST /auth/change-password": { json: { message: "ok", access_token: fresh, role: "admin" } },
      "POST /auth/logout-all": { status: 204 },
    });
    renderWithProviders(<AdminAccountPage />);
    expect(await screen.findByText("admin@tallyhawk.test")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Current password"), "Admin-pass1");
    await userEvent.type(screen.getByLabelText("New password"), "Admin-pass2");
    await userEvent.type(screen.getByLabelText("Confirm new password"), "Admin-pass3");
    await userEvent.click(screen.getByRole("button", { name: "Update password" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Passwords do not match.");

    await userEvent.clear(screen.getByLabelText("Confirm new password"));
    await userEvent.type(screen.getByLabelText("Confirm new password"), "Admin-pass2");
    await userEvent.click(screen.getByRole("button", { name: "Update password" }));
    expect(await screen.findByText(/Password updated/)).toBeInTheDocument();
    expect(localStorage.getItem("token")).toBe(fresh);

    await userEvent.click(screen.getByRole("button", { name: "Sign out everywhere" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/login"));
    expect(server.callsTo("POST /auth/logout-all")).toHaveLength(1);
  });
});
