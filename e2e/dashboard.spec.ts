import { test, expect, accountRoutes } from "./support/fixtures";

interface Doc {
  id: string;
  filename: string;
  s3_url: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  created_at: string;
  quickbooks_synced: boolean;
  flags?: string | null;
}

const doc = (
  id: string,
  status: Doc["status"],
  filename = `${id}.pdf`,
  extra: Partial<Doc> = {}
): Doc => ({
  id,
  filename,
  s3_url: `https://bucket.tallyhawk.test/${filename}`,
  status,
  created_at: new Date().toISOString(),
  quickbooks_synced: false,
  ...extra,
});

const extraction = (id: string, vendor: string, amount: number) => ({
  json: {
    document_id: id,
    extracted_data: { vendor, total_amount: String(amount), date: "2026-09-10" },
    confidence_score: 0.98,
    category: "Software",
    original_currency: "EUR",
    original_amount: amount,
    converted_amount: Math.round(amount * 1.1 * 100) / 100,
    converted_currency: "USD",
    exchange_rate: 1.1,
  },
});

test.describe("dashboard", () => {
  test.beforeEach(async ({ signIn }) => {
    await signIn();
  });

  test("shows processed documents with converted amounts and flags", async ({ page, api }) => {
    api.set({
      ...accountRoutes(),
      "GET /documents/": {
        json: [
          doc("a", "COMPLETED", "figma.pdf", { flags: "possible_duplicate" }),
          doc("b", "FAILED", "blurry.jpg"),
        ],
      },
      "GET /extraction/a": extraction("a", "Figma", 40),
      "GET /stats/dashboard": {
        json: { processed: 2, synced: 0, month_spend: 44, base_currency: "USD" },
      },
    });

    await page.goto("/app");

    await expect(page.getByRole("heading", { name: "Results (1)" })).toBeVisible();
    await expect(page.getByText("Figma", { exact: true })).toBeVisible();
    await expect(page.getByText("Rate: 1 EUR = 1.1000 USD")).toBeVisible();
    await expect(page.getByText("Duplicate")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Failed (1)" })).toBeVisible();
    await expect(page.getByText("3 / 10 documents")).toBeVisible();
  });

  test("uploading a receipt runs it through processing to extracted data", async ({
    page,
    api,
  }) => {
    let documents: Doc[] = [];
    api.set({
      ...accountRoutes(),
      "GET /documents/": () => ({ json: documents }),
      "POST /upload/": () => {
        documents = [doc("new", "PROCESSING", "receipt.pdf")];
        return { json: documents[0] };
      },
      "GET /extraction/new": extraction("new", "Hetzner Online", 44.6),
    });

    await page.goto("/app");
    await expect(page.getByText("No documents yet")).toBeVisible();

    await page
      .locator("#file-upload")
      .setInputFiles({
        name: "receipt.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4"),
      });
    await expect(page.getByRole("heading", { name: "Processing (1)" })).toBeVisible();

    // The backend finishes; the 3-second poll picks it up.
    documents = [doc("new", "COMPLETED", "receipt.pdf")];
    await expect(page.getByText("Hetzner Online")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("heading", { name: "Results (1)" })).toBeVisible();
    expect(api.calls("POST /upload/")).toHaveLength(1);
  });

  test("rejects unsupported files without calling the backend", async ({ page, api }) => {
    api.set(accountRoutes());
    await page.goto("/app");
    await page
      .locator("#file-upload")
      .setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });

    await expect(
      page.getByRole("alert").filter({ hasText: "Unsupported file extension" })
    ).toBeVisible();
    expect(api.calls("POST /upload/")).toHaveLength(0);
  });

  test("hitting the free limit offers an upgrade", async ({ page, api }) => {
    api.set({
      ...accountRoutes({ used: 10 }),
      "POST /upload/": { status: 403, json: { detail: { error: "limit_exceeded" } } },
    });
    await page.goto("/app");
    await page
      .locator("#file-upload")
      .setInputFiles({ name: "r.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF") });

    await expect(page.getByRole("heading", { name: "Free Tier Limit Reached" })).toBeVisible();
    await page.getByRole("button", { name: "Upgrade to Pro" }).click();
    await expect(page).toHaveURL(/\/pricing$/);
  });

  test("failed documents can be deleted", async ({ page, api }) => {
    let documents = [doc("bad", "FAILED", "blurry.jpg")];
    api.set({
      ...accountRoutes(),
      "GET /documents/": () => ({ json: documents }),
      "DELETE /documents/bad": () => {
        documents = [];
        return { status: 204 };
      },
    });

    await page.goto("/app");
    await page.getByRole("button", { name: "Delete document" }).click();

    await expect(page.getByRole("heading", { name: "Failed (1)" })).toBeHidden();
    expect(api.calls("DELETE /documents/bad")).toHaveLength(1);
  });

  test("Pro users with QuickBooks connected can sync a document", async ({ page, api, signIn }) => {
    await signIn({ plan: "pro" });
    api.set({
      ...accountRoutes({ plan: "pro" }),
      "GET /quickbooks/status": { json: { connected: true } },
      "GET /documents/": { json: [doc("a", "COMPLETED", "figma.pdf")] },
      "GET /extraction/a": extraction("a", "Figma", 40),
      "GET /quickbooks/sync-status/a": { json: { synced: false } },
      "POST /quickbooks/sync/a": { json: {} },
    });

    await page.goto("/app");
    await page.getByRole("button", { name: "Sync to QB" }).click();

    // The stats row also has a "Synced" label; the badge replaces the button.
    await expect(page.locator("span").filter({ hasText: /^Synced$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sync to QB" })).toBeHidden();
    expect(api.calls("POST /quickbooks/sync/a")).toHaveLength(1);
  });
});
