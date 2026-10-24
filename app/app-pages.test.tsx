import { describe, it, expect, vi, beforeEach } from "vitest";
import { cloneElement, isValidElement, type ReactElement } from "react";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AnalyticsPage from "./analytics/page";
import VendorsPage from "./vendors/page";
import AccountPage from "./account/page";
import CapturePage from "./capture/page";
import BillingSuccess from "./billing/success/page";
import BillingCancelled from "./billing/cancelled/page";
import { renderWithProviders } from "@/test/render";
import { accountRoutes, mockApi, type Routes } from "@/test/api-mock";
import { router, setSearchParams } from "@/test/navigation";
import { makeToken, signIn, signInExpired } from "@/test/auth";

// ResponsiveContainer measures its parent, which is 0×0 in jsdom; give charts a fixed size.
vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactElement }) =>
      isValidElement(children)
        ? cloneElement(children as ReactElement<{ width: number; height: number }>, {
            width: 800,
            height: 300,
          })
        : null,
  };
});

// jsdom doesn't implement navigation (window.location.href = ... / reload()).
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    if (String(args[0]).includes("Not implemented: navigation")) return;
    throw new Error(String(args[0]));
  });
});

function as(plan: "free" | "pro", routes: Routes = {}) {
  signIn({ plan, sub: "ada@example.com" });
  return mockApi({ ...accountRoutes({ plan }), ...routes });
}

describe("analytics page", () => {
  const year = new Date().getFullYear();

  it("redirects signed-out visitors", () => {
    mockApi();
    renderWithProviders(<AnalyticsPage />);
    expect(router.push).toHaveBeenCalledWith("/login");
  });

  it("is an upsell for free users", async () => {
    as("free");
    renderWithProviders(<AnalyticsPage />);
    expect(
      await screen.findByRole("heading", { level: 1, name: "Upgrade to Pro" })
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "View Pricing" }));
    expect(router.push).toHaveBeenCalledWith("/pricing");
  });

  it("loads all three charts for Pro users and refetches when filters change", async () => {
    const server = as("pro", {
      "GET /analytics/spend-by-category": {
        json: [
          { name: "Software", value: 120 },
          { name: "Travel", value: 80 },
        ],
      },
      "GET /analytics/spend-by-vendor": { json: [{ name: "Figma", value: 45 }] },
      "GET /analytics/monthly-trend": { json: [{ month: "Jan", spend: 50 }] },
    });
    renderWithProviders(<AnalyticsPage />);

    expect(await screen.findByRole("heading", { level: 1, name: "Analytics" })).toBeInTheDocument();
    expect(screen.getByText(`Monthly Spend Trend (${year}) - USD`)).toBeInTheDocument();
    expect(screen.getByText("Software")).toBeInTheDocument();

    await userEvent.selectOptions(screen.getAllByRole("combobox")[1], "March");
    await waitFor(() =>
      expect(server.requests.some((r) => r.url.search === `?year=${year}&month=3`)).toBe(true)
    );
    // The page shows a spinner while refetching, so query the selects again once it settles.
    await userEvent.selectOptions((await screen.findAllByRole("combobox"))[0], String(year - 1));
    await waitFor(() =>
      expect(server.requests.some((r) => r.url.search === `?year=${year - 1}&month=3`)).toBe(true)
    );
  });

  it("doesn't flash the upsell at a Pro user whose token still says free", async () => {
    signIn({ plan: "free" });
    mockApi({
      ...accountRoutes({ plan: "pro" }),
      "GET /analytics/spend-by-category": { json: [] },
      "GET /analytics/spend-by-vendor": { json: [] },
      "GET /analytics/monthly-trend": { json: [] },
    });
    renderWithProviders(<AnalyticsPage />);
    expect(screen.queryByRole("heading", { name: "Upgrade to Pro" })).toBeNull();
    expect(await screen.findByRole("heading", { level: 1, name: "Analytics" })).toBeInTheDocument();
  });

  it("shows empty states when there is no data for the period", async () => {
    as("pro", {
      "GET /analytics/spend-by-category": { json: [] },
      "GET /analytics/spend-by-vendor": { json: [] },
      "GET /analytics/monthly-trend": { json: [] },
    });
    renderWithProviders(<AnalyticsPage />);
    expect(await screen.findByText("No data available for this period.")).toBeInTheDocument();
    expect(screen.getAllByText("No data available.")).toHaveLength(2);
  });
});

describe("vendors page", () => {
  const vendors = [
    { id: "v1", canonical_name: "Amazon", aliases: ["AMZN Mktp", "Amazon.com"] },
    { id: "v2", canonical_name: "Figma", aliases: [] },
  ];

  it("redirects signed-out visitors", () => {
    mockApi();
    renderWithProviders(<VendorsPage />);
    expect(router.push).toHaveBeenCalledWith("/login");
  });

  it("redirects an expired session without calling the API", () => {
    signInExpired();
    const server = mockApi();
    renderWithProviders(<VendorsPage />);
    expect(router.push).toHaveBeenCalledWith("/login");
    expect(server.requests).toHaveLength(0);
  });

  it("explains a rejected rename or merge instead of silently doing nothing", async () => {
    as("free", {
      "GET /vendors": { json: vendors },
      "PATCH /vendors/v2/rename": {
        status: 400,
        json: { detail: "Another vendor already has that name. Merge the two vendors instead." },
      },
      "POST /vendors/v1/merge": { status: 404, json: { detail: "Vendor(s) not found" } },
    });
    vi.spyOn(window, "prompt").mockReturnValue("Amazon");
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderWithProviders(<VendorsPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Figma" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Another vendor already has that name.");

    const amazonRow = screen.getByRole("button", { name: "Amazon" }).closest("div.rounded-2xl") as HTMLElement;
    await userEvent.click(within(amazonRow).getByRole("button", { name: "Merge Into..." }));
    await userEvent.selectOptions(within(amazonRow).getByRole("combobox"), "v2");
    expect(await screen.findByRole("alert")).toHaveTextContent("Vendor(s) not found");
  });

  it("lists vendors with their aliases", async () => {
    as("free", { "GET /vendors": { json: vendors } });
    renderWithProviders(<VendorsPage />);
    expect(await screen.findByRole("button", { name: "Amazon" })).toBeInTheDocument();
    expect(screen.getByText("Aliases: AMZN Mktp, Amazon.com")).toBeInTheDocument();
    expect(screen.getByText("Aliases: None")).toBeInTheDocument();
  });

  it("renames a vendor", async () => {
    const server = as("free", {
      "GET /vendors": { json: vendors },
      "PATCH /vendors/v2/rename": { json: {} },
    });
    vi.spyOn(window, "prompt").mockReturnValue("  Figma Inc. ");
    renderWithProviders(<VendorsPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Figma" }));

    await waitFor(() => expect(server.callsTo("PATCH /vendors/v2/rename")).toHaveLength(1));
    expect(server.callsTo("PATCH /vendors/v2/rename")[0].body).toEqual({ new_name: "Figma Inc." });
  });

  it("ignores an unchanged or cancelled rename", async () => {
    const server = as("free", { "GET /vendors": { json: vendors } });
    const prompt = vi
      .spyOn(window, "prompt")
      .mockReturnValueOnce("Figma")
      .mockReturnValueOnce(null);
    renderWithProviders(<VendorsPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Figma" }));
    await userEvent.click(screen.getByRole("button", { name: "Figma" }));

    expect(prompt).toHaveBeenCalledTimes(2);
    expect(server.requests.filter((r) => r.method === "PATCH")).toHaveLength(0);
  });

  it("merges one vendor into another after confirmation", async () => {
    const server = as("free", {
      "GET /vendors": { json: vendors },
      "POST /vendors/v1/merge": { json: {} },
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderWithProviders(<VendorsPage />);

    const amazonRow = (await screen.findByRole("button", { name: "Amazon" })).closest(
      "div.rounded-2xl"
    ) as HTMLElement;
    await userEvent.click(within(amazonRow).getByRole("button", { name: "Merge Into..." }));
    await userEvent.selectOptions(within(amazonRow).getByRole("combobox"), "v2");

    await waitFor(() => expect(server.callsTo("POST /vendors/v1/merge")).toHaveLength(1));
    expect(server.callsTo("POST /vendors/v1/merge")[0].body).toEqual({ target_vendor_id: "v2" });
  });

  it("can cancel a merge", async () => {
    as("free", { "GET /vendors": { json: vendors } });
    renderWithProviders(<VendorsPage />);
    await userEvent.click((await screen.findAllByRole("button", { name: "Merge Into..." }))[0]);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("shows an empty state", async () => {
    as("free", { "GET /vendors": { json: [] } });
    renderWithProviders(<VendorsPage />);
    expect(await screen.findByText(/No vendors found/)).toBeInTheDocument();
  });

  it("returns to login when the session has expired server-side", async () => {
    as("free", { "GET /vendors": { status: 401, json: {} } });
    renderWithProviders(<VendorsPage />);
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/login"));
  });
});

describe("account page", () => {
  it("redirects signed-out visitors", () => {
    signInExpired();
    mockApi();
    renderWithProviders(<AccountPage />);
    expect(router.push).toHaveBeenCalledWith("/login");
  });

  it("shows the signed-in email and free plan with an upgrade path", async () => {
    as("free", { "GET /quickbooks/status": { json: { connected: false } } });
    renderWithProviders(<AccountPage />);

    expect(await screen.findByDisplayValue("ada@example.com")).toBeDisabled();
    // When the account was created (settings.created_at), not when this token was issued.
    expect(await screen.findByLabelText("Member Since")).toHaveValue(
      new Date("2026-01-01T00:00:00Z").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    );
    expect(screen.getByText("10 documents / month")).toBeInTheDocument();
    expect(screen.getByText("Free Tier")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Tax Export" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Upgrade" }));
    expect(router.push).toHaveBeenCalledWith("/pricing");
  });

  it("changes the base currency", async () => {
    const server = as("free", {
      "GET /quickbooks/status": { json: { connected: false } },
      "PATCH /auth/settings": { json: {} },
    });
    renderWithProviders(<AccountPage />);

    await userEvent.selectOptions(
      await screen.findByRole("combobox", { name: "Base currency" }),
      "EUR"
    );

    expect(await screen.findByRole("status")).toHaveTextContent("Currency updated!");
    expect(server.callsTo("PATCH /auth/settings")[0].body).toEqual({ base_currency: "EUR" });
    // The select saves on change; a second "Save" re-sent the same currency and claimed a reconversion.
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  });

  it("shows when the session expires under that label (regression: it was labelled 'Session Started')", async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    signIn({ exp });
    mockApi({ ...accountRoutes(), "GET /quickbooks/status": { json: { connected: false } } });
    renderWithProviders(<AccountPage />);
    expect(await screen.findByLabelText("Session Expires")).toHaveValue(new Date(exp * 1000).toLocaleString());
    expect(screen.queryByLabelText("Session Started")).toBeNull();
  });

  it("reports a failed currency change", async () => {
    as("free", {
      "GET /quickbooks/status": { json: { connected: false } },
      // The API's real 422 shape: a list of issues (regression: rendered as "[object Object]").
      "PATCH /auth/settings": {
        status: 422,
        json: { detail: [{ loc: ["body", "base_currency"], msg: "Unsupported currency", type: "custom" }] },
      },
    });
    renderWithProviders(<AccountPage />);
    await userEvent.selectOptions(
      await screen.findByRole("combobox", { name: "Base currency" }),
      "JPY"
    );
    expect(await screen.findByText("Unsupported currency")).toBeInTheDocument();
  });

  it("validates and changes the password", async () => {
    const fresh = makeToken({ plan: "free", role: "user", ver: 1 });
    const server = as("free", {
      "GET /quickbooks/status": { json: { connected: false } },
      "POST /auth/change-password": { json: { message: "Password updated successfully.", access_token: fresh, token_type: "bearer", role: "user" } },
    });
    renderWithProviders(<AccountPage />);

    await userEvent.type(await screen.findByLabelText("Current Password"), "OldSecret1");
    await userEvent.type(screen.getByLabelText("New Password"), "weakpass");
    await userEvent.type(screen.getByLabelText("Confirm New Password"), "weakpass");
    await userEvent.click(screen.getByRole("button", { name: "Update Password" }));
    expect(
      screen.getByText("Password must contain at least one uppercase letter.")
    ).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("New Password"));
    await userEvent.clear(screen.getByLabelText("Confirm New Password"));
    await userEvent.type(screen.getByLabelText("New Password"), "NewSecret1");
    await userEvent.type(screen.getByLabelText("Confirm New Password"), "NewSecret1");
    await userEvent.click(screen.getByRole("button", { name: "Update Password" }));

    expect(await screen.findByText("Password updated successfully.")).toBeInTheDocument();
    expect(server.callsTo("POST /auth/change-password")[0].body).toEqual({
      current_password: "OldSecret1",
      new_password: "NewSecret1",
    });
    // Other sessions were revoked; this one continues on the token issued with the change.
    expect(localStorage.getItem("token")).toBe(fresh);
  });

  it("surfaces a wrong current password", async () => {
    as("free", {
      "GET /quickbooks/status": { json: { connected: false } },
      "POST /auth/change-password": {
        status: 400,
        json: { detail: "Current password is incorrect" },
      },
    });
    renderWithProviders(<AccountPage />);
    await userEvent.type(await screen.findByLabelText("Current Password"), "nope");
    await userEvent.type(screen.getByLabelText("New Password"), "NewSecret1");
    await userEvent.type(screen.getByLabelText("Confirm New Password"), "NewSecret1");
    await userEvent.click(screen.getByRole("button", { name: "Update Password" }));
    expect(await screen.findByText("Current password is incorrect")).toBeInTheDocument();
  });

  it("gives Pro users tax export and QuickBooks management", async () => {
    const server = as("pro", {
      "GET /quickbooks/status": { json: { connected: true } },
      "DELETE /quickbooks/disconnect": { json: {} },
      "GET /reports/tax-summary": {
        body: "category,total\n",
        headers: { "Content-Type": "text/csv" },
      },
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.stubGlobal(
      "URL",
      Object.assign(URL, { createObjectURL: () => "blob:x", revokeObjectURL: () => {} })
    );
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    renderWithProviders(<AccountPage />);

    expect(await screen.findByText("Tallyhawk Pro")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Export CSV" }));
    await waitFor(() => expect(click).toHaveBeenCalled());

    await userEvent.click(await screen.findByRole("button", { name: "Disconnect" }));
    expect(await screen.findByText("QuickBooks disconnected successfully.")).toBeInTheDocument();
    expect(server.callsTo("DELETE /quickbooks/disconnect")).toHaveLength(1);
  });

  it("starts the QuickBooks OAuth flow for Pro users", async () => {
    const server = as("pro", {
      "GET /quickbooks/status": { json: { connected: false } },
      "GET /quickbooks/connect": { json: { url: "https://appcenter.intuit.test/connect" } },
    });
    renderWithProviders(<AccountPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Connect" }));
    await waitFor(() => expect(server.callsTo("GET /quickbooks/connect")).toHaveLength(1));
  });

  it("confirms a successful QuickBooks callback and cleans the URL", async () => {
    setSearchParams({ qb_success: "true" });
    as("pro", { "GET /quickbooks/status": { json: { connected: false } } });
    renderWithProviders(<AccountPage />);
    expect(await screen.findByText("QuickBooks connected successfully!")).toBeInTheDocument();
    expect(router.replace).toHaveBeenCalledWith("/account");
  });

  it("reports a failed QuickBooks callback", async () => {
    setSearchParams({ qb_error: "access_denied" });
    as("pro", { "GET /quickbooks/status": { json: { connected: false } } });
    renderWithProviders(<AccountPage />);
    expect(
      await screen.findByText("Failed to connect QuickBooks. Please try again.")
    ).toBeInTheDocument();
  });

  it("warns that deleting is final and unrefundable, and needs the acknowledgement and the phrase", async () => {
    const server = as("free", {
      "GET /quickbooks/status": { json: { connected: false } },
      "DELETE /auth/delete": { status: 204 },
    });
    renderWithProviders(<AccountPage />);
    const button = await screen.findByRole("button", { name: "Permanently Delete Account" });
    const danger = screen.getByRole("region", { name: "Danger Zone" });
    expect(danger).toHaveTextContent("you can't claim a refund, credit or any other compensation for payments you've already made");
    expect(danger).toHaveTextContent("Nothing can be recovered.");
    expect(danger).toHaveTextContent("Your account can't be restored.");
    expect(danger).toHaveTextContent("for 120 days to handle payment disputes; after that only an anonymized version remains");
    expect(button).toBeDisabled();

    // The phrase alone isn't enough.
    await userEvent.type(screen.getByLabelText(/to confirm/), "delete my account");
    expect(button).toBeDisabled();
    await userEvent.click(screen.getByRole("checkbox", { name: /won't get a refund and can't recover/ }));
    expect(button).toBeEnabled();
    await userEvent.click(button);

    await waitFor(() => expect(server.callsTo("DELETE /auth/delete")).toHaveLength(1));
    expect(localStorage.getItem("token")).toBeNull();
    expect(router.push).toHaveBeenCalledWith("/");
  });

  it("explains a failed deletion and keeps the user signed in", async () => {
    as("free", {
      "GET /quickbooks/status": { json: { connected: false } },
      "DELETE /auth/delete": { status: 502, json: { detail: "Couldn't cancel your subscription. Please try again." } },
    });
    renderWithProviders(<AccountPage />);
    await userEvent.click(await screen.findByRole("checkbox", { name: /won't get a refund/ }));
    await userEvent.type(screen.getByLabelText(/to confirm/), "delete my account");
    await userEvent.click(screen.getByRole("button", { name: "Permanently Delete Account" }));
    expect(await screen.findByText("Couldn't cancel your subscription. Please try again.")).toBeInTheDocument();
    expect(localStorage.getItem("token")).not.toBeNull();
  });

  it("offers installing the app only where the browser supports it", async () => {
    as("free", { "GET /quickbooks/status": { json: { connected: false } } });
    renderWithProviders(<AccountPage />);
    // jsdom has no install support, so the section says so instead of showing a dead button.
    expect(await screen.findByText(/This browser can't install web apps/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Install Tallyhawk" })).toBeNull();
  });

  it("shows renewal dates and opens the Stripe billing portal for subscribers", async () => {
    const server = as("pro", {
      "GET /quickbooks/status": { json: { connected: false } },
      "GET /billing/subscription": {
        json: { plan: "pro", status: "active", current_period_end: "2026-11-23T00:00:00Z", last_renewal_date: "2026-10-23T00:00:00Z", cancel_at_period_end: false, can_manage: true },
      },
      "POST /billing/portal": { json: { url: "https://billing.stripe.test/p" } },
    });
    renderWithProviders(<AccountPage />);
    expect(await screen.findByLabelText("Next Renewal")).toHaveValue("November 23, 2026");
    await userEvent.click(screen.getByRole("button", { name: "Manage billing" }));
    await waitFor(() => expect(server.callsTo("POST /billing/portal")).toHaveLength(1));
  });

  it("says when Pro is ending or a payment failed", async () => {
    as("pro", {
      "GET /quickbooks/status": { json: { connected: false } },
      "GET /billing/subscription": {
        json: { plan: "pro", status: "past_due", current_period_end: "2026-11-23T00:00:00Z", last_renewal_date: null, cancel_at_period_end: true, can_manage: true },
      },
      "POST /billing/portal": { status: 502, json: { detail: "Couldn't open the billing portal. Please try again." } },
    });
    renderWithProviders(<AccountPage />);
    expect(await screen.findByText("Payment issue")).toBeInTheDocument();
    expect(screen.getByLabelText("Pro Ends On")).toHaveValue("November 23, 2026");
    await userEvent.click(screen.getByRole("button", { name: "Manage billing" }));
    expect(await screen.findByText("Couldn't open the billing portal. Please try again.")).toBeInTheDocument();
  });

  it("signs out of every device", async () => {
    const server = as("free", { "GET /quickbooks/status": { json: { connected: false } }, "POST /auth/logout-all": { status: 204 } });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderWithProviders(<AccountPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Sign out of all devices →" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/login"));
    expect(server.callsTo("POST /auth/logout-all")).toHaveLength(1);
    expect(localStorage.getItem("token")).toBeNull();
  });

  it("signs out of the current session", async () => {
    as("free", { "GET /quickbooks/status": { json: { connected: false } } });
    renderWithProviders(<AccountPage />);
    await userEvent.click(
      await screen.findByRole("button", { name: "Sign out of this session →" })
    );
    expect(localStorage.getItem("token")).toBeNull();
    expect(router.push).toHaveBeenCalledWith("/login");
  });
});

describe("capture page", () => {
  function capture(container: HTMLElement) {
    return container.querySelector<HTMLInputElement>("#camera-upload")!;
  }

  it("redirects signed-out visitors (the installed app opens here directly)", () => {
    mockApi();
    renderWithProviders(<CapturePage />);
    expect(router.push).toHaveBeenCalledWith("/login");
  });

  it("uploads a photo and confirms it", async () => {
    const server = as("free", { "POST /upload": { json: { id: "x" } } });
    const { container } = renderWithProviders(<CapturePage />);
    expect(capture(container)).toHaveAttribute("capture", "environment");

    await userEvent.upload(
      capture(container),
      new File(["img"], "receipt.jpg", { type: "image/jpeg" })
    );

    expect(await screen.findByRole("status")).toHaveTextContent("Uploaded!");
    expect(server.callsTo("POST /upload")).toHaveLength(1);
  });

  it("explains the free-tier limit", async () => {
    as("free", { "POST /upload": { status: 403, json: { detail: { error: "limit_exceeded" } } } });
    const { container } = renderWithProviders(<CapturePage />);
    await userEvent.upload(
      capture(container),
      new File(["img"], "receipt.jpg", { type: "image/jpeg" })
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Free tier limit reached.");
  });

  it("rejects oversized files before uploading", async () => {
    const server = as("free");
    const { container } = renderWithProviders(<CapturePage />);
    const huge = new File([new Uint8Array(11 * 1024 * 1024)], "huge.jpg", { type: "image/jpeg" });
    await userEvent.upload(capture(container), huge);
    expect(await screen.findByRole("alert")).toHaveTextContent("File too large");
    expect(server.callsTo("POST /upload")).toHaveLength(0);
  });

  it("goes back to the dashboard", async () => {
    as("free");
    renderWithProviders(<CapturePage />);
    await userEvent.click(screen.getByRole("button", { name: "← Back" }));
    expect(router.push).toHaveBeenCalledWith("/app");
  });
});

describe("billing return pages", () => {
  it("confirms the checkout by its session id and swaps in a Pro token, without signing out", async () => {
    const proToken = makeToken({ plan: "pro", role: "user" });
    setSearchParams({ session_id: "cs_test_123" });
    const server = as("free", {
      "POST /billing/confirm": { json: { plan: "pro", status: "complete", access_token: proToken, token_type: "bearer", role: "user" } },
    });
    renderWithProviders(<BillingSuccess />);

    expect(await screen.findByRole("heading", { name: "Welcome to Pro!" })).toBeInTheDocument();
    expect(server.callsTo("POST /billing/confirm")[0].body).toEqual({ session_id: "cs_test_123" });
    // Regression: the page used to delete the token and send the user to /login.
    expect(localStorage.getItem("token")).toBe(proToken);
    expect(router.push).not.toHaveBeenCalledWith("/login");
    expect(screen.getByRole("link", { name: "Go to Dashboard" })).toHaveAttribute("href", "/app");
  });

  it("keeps checking while Stripe finishes, then says it's still processing", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setSearchParams({ session_id: "cs_test_123" });
    const server = as("free", { "POST /billing/confirm": { status: 202, json: { plan: "free", status: "open" } } });
    renderWithProviders(<BillingSuccess />);
    expect(screen.getByRole("heading", { name: "Confirming Subscription..." })).toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(16_000));
    expect(await screen.findByRole("heading", { name: "Payment Processing" })).toBeInTheDocument();
    expect(screen.getByText(/no need to sign out/)).toBeInTheDocument();
    expect(server.callsTo("POST /billing/confirm")).toHaveLength(8);
  });

  it("falls back to the plan from the API when Stripe didn't pass a session id", async () => {
    as("pro");
    renderWithProviders(<BillingSuccess />);
    expect(await screen.findByRole("heading", { name: "Welcome to Pro!" })).toBeInTheDocument();
  });

  it("explains a confirmation failure", async () => {
    setSearchParams({ session_id: "cs_test_123" });
    as("free", { "POST /billing/confirm": { status: 404, json: { detail: "Checkout session not found." } } });
    renderWithProviders(<BillingSuccess />);
    expect(await screen.findByRole("heading", { name: "Payment Processing" })).toBeInTheDocument();
    expect(screen.getByText(/Checkout session not found/)).toBeInTheDocument();
  });

  it("reassures after a cancelled checkout", async () => {
    renderWithProviders(<BillingCancelled />);
    expect(screen.getByText("You were not charged. You can upgrade anytime.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Pricing" })).toHaveAttribute("href", "/pricing");
  });
});

describe("customer pages are for customers only", () => {
  it.each([
    ["dashboard-adjacent analytics", AnalyticsPage],
    ["vendors", VendorsPage],
    ["account", AccountPage],
    ["capture", CapturePage],
    ["billing success", BillingSuccess],
  ])("%s sends an admin to the admin dashboard without calling customer APIs", (_name, Page) => {
    signIn({ role: "admin", plan: undefined });
    const server = mockApi();
    renderWithProviders(<Page />);
    expect(router.replace).toHaveBeenCalledWith("/admin");
    expect(server.requests.filter((r) => r.path !== "/quickbooks/status")).toEqual([]);
  });
});
