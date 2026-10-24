import { test, expect, accountRoutes, makeToken } from "./support/fixtures";
import { STRIPE_CHECKOUT_URL } from "./support/constants";

test.describe("account, billing and analytics", () => {
  test("changing the base currency saves it and tells the dashboard to refresh", async ({
    page,
    api,
    signIn,
  }) => {
    await signIn();
    api.set({ ...accountRoutes(), "PATCH /auth/settings": { json: {} } });

    await page.goto("/account");
    await expect(page.getByLabel("Email Address")).toHaveValue("ada@example.com");
    await page.getByRole("combobox", { name: "Base currency" }).selectOption("EUR");

    await expect(page.getByRole("status")).toContainText("Currency updated!");
    expect(api.calls("PATCH /auth/settings")[0].body).toEqual({ base_currency: "EUR" });
    expect(await page.evaluate(() => localStorage.getItem("tallyhawk_base_currency"))).toBe("EUR");
  });

  test("upgrading sends a free user to Stripe Checkout", async ({ page, api, signIn }) => {
    await signIn();
    api.set({
      ...accountRoutes(),
      "POST /billing/create-checkout-session": { json: { url: STRIPE_CHECKOUT_URL } },
    });
    await page.route("https://checkout.stripe.test/**", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<title>Stripe Checkout</title><h1>Pay Tallyhawk</h1>",
      })
    );

    await page.goto("/pricing");
    await expect(page.getByRole("button", { name: "Current plan" })).toBeDisabled();
    await page.getByRole("button", { name: "Upgrade to Pro" }).click();

    await expect(page).toHaveURL(STRIPE_CHECKOUT_URL);
    await expect(page.getByRole("heading", { name: "Pay Tallyhawk" })).toBeVisible();
  });

  test("returning from Stripe confirms the checkout and unlocks Pro without signing out", async ({
    page,
    api,
    signIn,
  }) => {
    await signIn();
    const proToken = makeToken({ plan: "pro", role: "user" });
    api.set({
      ...accountRoutes(),
      "POST /billing/confirm": {
        json: { plan: "pro", status: "complete", access_token: proToken, token_type: "bearer", role: "user" },
      },
    });

    await page.goto("/billing/success?session_id=cs_test_123");
    await expect(page.getByRole("heading", { name: "Welcome to Pro!" })).toBeVisible();
    expect(api.calls("POST /billing/confirm")[0].body).toEqual({ session_id: "cs_test_123" });
    expect(await page.evaluate(() => localStorage.getItem("token"))).toBe(proToken);
    await expect(page).toHaveURL(/\/billing\/success/);
  });

  test("deleting an account warns there's no refund and needs an explicit acknowledgement", async ({
    page,
    api,
    signIn,
  }) => {
    await signIn();
    api.set({ ...accountRoutes(), "DELETE /auth/delete": { status: 204 } });

    await page.goto("/account");
    const danger = page.getByRole("region", { name: "Danger Zone" });
    await expect(danger.getByText("No refunds.")).toBeVisible();
    const button = danger.getByRole("button", { name: "Permanently Delete Account" });
    await danger.getByLabel(/to confirm/).fill("delete my account");
    await expect(button).toBeDisabled();
    await danger.getByRole("checkbox", { name: /won't get a refund/ }).check();
    await button.click();

    await expect(page).toHaveURL(/\/$/);
    expect(api.calls("DELETE /auth/delete")).toHaveLength(1);
  });

  test("signed-out visitors are asked to log in before upgrading", async ({ page }) => {
    await page.goto("/pricing");
    await page.getByRole("link", { name: "Upgrade to Pro" }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("Pro users see spend analytics charts", async ({ page, api, signIn }) => {
    await signIn({ plan: "pro" });
    api.set({
      ...accountRoutes({ plan: "pro" }),
      "GET /analytics/spend-by-category": {
        json: [
          { name: "Software", value: 320 },
          { name: "Travel", value: 120 },
        ],
      },
      "GET /analytics/spend-by-vendor": { json: [{ name: "Figma", value: 180 }] },
      "GET /analytics/monthly-trend": {
        json: [
          { month: "Jan", spend: 120 },
          { month: "Feb", spend: 320 },
        ],
      },
    });

    await page.goto("/analytics");

    await expect(page.getByRole("heading", { level: 1, name: "Analytics" })).toBeVisible();
    await expect(page.locator("svg.recharts-surface")).toHaveCount(3);
    await expect(page.getByText("Software")).toBeVisible();
  });

  test("free users get an upgrade prompt instead of analytics", async ({ page, api, signIn }) => {
    await signIn();
    api.set(accountRoutes());
    await page.goto("/analytics");
    await expect(page.getByRole("heading", { level: 1, name: "Upgrade to Pro" })).toBeVisible();
  });

  test("vendors can be merged", async ({ page, api, signIn }) => {
    await signIn();
    let vendors = [
      { id: "v1", canonical_name: "AMZN Mktp", aliases: [] },
      { id: "v2", canonical_name: "Amazon", aliases: ["Amazon.com"] },
    ];
    api.set({
      ...accountRoutes(),
      "GET /vendors": () => ({ json: vendors }),
      "POST /vendors/v1/merge": () => {
        vendors = [{ id: "v2", canonical_name: "Amazon", aliases: ["Amazon.com", "AMZN Mktp"] }];
        return { json: {} };
      },
    });
    page.on("dialog", (dialog) => dialog.accept());

    await page.goto("/vendors");
    await page.getByRole("button", { name: "Merge Into..." }).first().click();
    await page.getByRole("combobox").selectOption("v2");

    await expect(page.getByText("Aliases: Amazon.com, AMZN Mktp")).toBeVisible();
    await expect(page.getByRole("button", { name: "AMZN Mktp" })).toBeHidden();
  });
});
