import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "./support/fixtures";

// Automated WCAG 2.1 A/AA checks on every public page in both themes. Automated checks catch
// roughly a third of issues; the accessibility statement lists what still needs manual testing.

const PAGES = ["/", "/pricing", "/signup", "/login", "/privacy", "/terms", "/accessibility"];

for (const theme of ["light", "dark"] as const) {
  test.describe(`${theme} theme`, () => {
    test.use({ colorScheme: theme });

    for (const path of PAGES) {
      test(`${path} has no WCAG 2.1 AA violations`, async ({ page }) => {
        await page.goto(path);
        await expect(page.locator("html")).toHaveClass(new RegExp(theme));
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();

        const summary = results.violations.map((v) => ({
          rule: v.id,
          impact: v.impact,
          nodes: v.nodes.slice(0, 3).map((n) => n.target.join(" ")),
        }));
        expect(summary).toEqual([]);
      });
    }
  });
}
