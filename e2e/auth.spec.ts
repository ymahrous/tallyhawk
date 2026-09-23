import { test, expect, accountRoutes, makeToken } from "./support/fixtures";

test.describe("authentication", () => {
  test("signing up lands on the dashboard", async ({ page, api }) => {
    api.set({
      ...accountRoutes(),
      "POST /auth/signup": { json: { access_token: makeToken(), token_type: "bearer" } },
    });

    await page.goto("/signup");
    await page.getByLabel("Email address").fill("ada@example.com");
    await page.getByLabel("Password", { exact: true }).fill("Secret123");
    await page.getByLabel("Confirm password").fill("Secret123");
    await expect(page.getByText("Fair")).toBeVisible();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByRole("heading", { level: 1, name: "Documents" })).toBeVisible();
    expect(api.calls("POST /auth/signup")[0].body).toEqual({
      username: "ada@example.com",
      password: "Secret123",
    });
  });

  test("a wrong password shows the backend's message", async ({ page, api }) => {
    api.set({
      "POST /auth/login": { status: 401, json: { detail: "Incorrect email or password" } },
    });

    await page.goto("/login");
    await page.getByLabel("Email address").fill("ada@example.com");
    await page.getByLabel("Password", { exact: true }).fill("wrong-password");
    await page.getByRole("button", { name: "Continue" }).click();

    // Next's route announcer is also role="alert", so match on the message.
    await expect(
      page.getByRole("alert").filter({ hasText: "Incorrect email or password" })
    ).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("logging in opens the dashboard and logging out returns home", async ({
    page,
    api,
    isMobile,
  }) => {
    api.set({
      ...accountRoutes(),
      "POST /auth/login": { json: { access_token: makeToken(), token_type: "bearer" } },
    });

    await page.goto("/login");
    await page.getByLabel("Email address").fill("ada@example.com");
    await page.getByLabel("Password", { exact: true }).fill("Secret123");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/app$/);
    // Wait for the dashboard to mount; the URL changes before its auth check has run.
    await expect(page.getByRole("heading", { level: 1, name: "Documents" })).toBeVisible();

    if (isMobile) {
      await page.getByRole("button", { name: "Open menu" }).click();
      await page.locator("#mobile-menu").getByRole("button", { name: "Log out" }).click();
    } else {
      await page.getByRole("button", { name: "User menu" }).click();
      await page.getByRole("menuitem", { name: "Log out" }).click();
    }

    await expect(page).toHaveURL(/\/$/);
    expect(await page.evaluate(() => localStorage.getItem("token"))).toBeNull();
  });

  for (const path of ["/app", "/account", "/analytics", "/vendors", "/capture"]) {
    test(`${path} sends signed-out visitors to login`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
    });
  }

  test("an expired session is treated as signed out", async ({ page }) => {
    await page.addInitScript(
      (token) => localStorage.setItem("token", token),
      makeToken({ exp: Math.floor(Date.now() / 1000) - 60 })
    );
    await page.goto("/app");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("password recovery: request a link, then set a new password", async ({ page, api }) => {
    api.set({
      "POST /auth/forgot-password": { json: {} },
      "POST /auth/reset-password": { json: {} },
    });

    await page.goto("/login");
    await page.getByRole("link", { name: "Forgot password?" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Forgot Password" })).toBeVisible();
    await page.getByLabel("Email address").fill("ada@example.com");
    await page.getByRole("button", { name: "Send Reset Link" }).click();
    await expect(page.getByRole("status")).toContainText("If an account with that email exists");

    await page.goto("/reset-password?token=tok-123");
    await page.getByLabel("New password", { exact: true }).fill("NewSecret1");
    await page.getByLabel("Confirm new password").fill("NewSecret1");
    await page.getByRole("button", { name: "Reset Password" }).click();

    await expect(page.getByRole("status")).toHaveText("Password updated! Redirecting to login...");
    await expect(page).toHaveURL(/\/login$/, { timeout: 5_000 });
    expect(api.calls("POST /auth/reset-password")[0].body).toEqual({
      token: "tok-123",
      new_password: "NewSecret1",
    });
  });
});
