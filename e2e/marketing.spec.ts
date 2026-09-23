import { test, expect } from "./support/fixtures";

test.describe("marketing site", () => {
  test("home page tells the story and navigates to pricing", async ({ page, isMobile }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Turn receipts and invoices into tax-ready books"
    );
    await expect(page.getByRole("link", { name: "Start free" })).toHaveAttribute("href", "/signup");

    if (isMobile) {
      await page.getByRole("button", { name: "Open menu" }).click();
      await page.locator("#mobile-menu").getByRole("link", { name: "Pricing" }).click();
    } else {
      await page
        .getByRole("navigation", { name: "Main" })
        .getByRole("link", { name: "Pricing" })
        .click();
    }

    await expect(page).toHaveURL(/\/pricing$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Simple pricing");
    await expect(
      page.getByRole("table", { name: "Tallyhawk Free and Pro plan comparison" })
    ).toBeVisible();
  });

  test("FAQ answers expand in place", async ({ page }) => {
    await page.goto("/#faq");
    const question = page.getByRole("heading", { name: "Is there a free plan?" });
    const answer = page.getByText(/^Yes\. The Free plan includes 10 documents per month/);
    await expect(answer).toBeHidden();
    await question.click();
    await expect(answer).toBeVisible();
  });

  test("the logo returns home from any page", async ({ page }) => {
    await page.goto("/terms");
    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Tallyhawk home" })
      .click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("footer links reach the legal pages", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator("footer");
    await footer.getByRole("link", { name: "Privacy Policy" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeVisible();
    await page.locator("footer").getByRole("link", { name: "Accessibility" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Accessibility Statement" })
    ).toBeVisible();
  });

  test("theme choice persists across reloads without a flash", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    await expect(page.locator("html")).toHaveClass(/light/);

    await page.getByRole("button", { name: "Toggle theme" }).first().click();
    await expect(page.locator("html")).toHaveClass(/dark/);

    await page.reload();
    await expect(page.locator("html")).toHaveClass(/dark/);
  });

  test("keyboard users can skip straight to the content", async ({ page, isMobile }) => {
    test.skip(isMobile, "Keyboard navigation is a desktop concern");
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main-content$/);
  });

  test("unknown pages offer a way back", async ({ page }) => {
    await page.goto("/no-such-page");
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await page.getByRole("link", { name: "Back to home" }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe("cookie consent", () => {
  test.use({ seedConsent: false });

  test("asks once, remembers the answer, and can be reopened", async ({ page }) => {
    await page.goto("/");
    const banner = page.getByRole("dialog", { name: "Analytics consent" });
    await expect(banner).toBeVisible();

    await banner.getByRole("button", { name: "Reject" }).click();
    await expect(banner).toBeHidden();

    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(banner).toBeHidden();

    await page.locator("footer").getByRole("button", { name: "Cookie Preferences" }).click();
    await expect(banner).toBeVisible();
    await banner.getByRole("button", { name: "Close" }).click();
    await expect(banner).toBeHidden();
  });
});
