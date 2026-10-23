// @vitest-environment node
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/server/db";
import { documents, extractions, usageRecords, vendors } from "@/server/db/schema";
import { currentMonth } from "@/server/usage";
import { call, createDocument, createTestDb, createUser, flushBackground, resetTestDb } from "@/test/server";
import { GET as listDocuments } from "./route";
import { DELETE as deleteDocument } from "./[documentId]/route";
import { GET as getExtraction } from "../extraction/[documentId]/route";
import { PATCH as updateCategory } from "../extraction/[documentId]/category/route";
import { GET as taxSummary } from "../reports/tax-summary/route";
import { POST as upload } from "../upload/route";

vi.mock("@/server/background", async () => (await import("@/test/server")).backgroundMock);
const storage = vi.hoisted(() => ({
  uploadToStorage: vi.fn(async (_bytes: Uint8Array, path: string) => `https://bucket.test/${path}`),
  deleteFromStorage: vi.fn(async () => {}),
}));
vi.mock("@/server/storage", () => storage);
const pipeline = vi.hoisted(() => ({ processDocument: vi.fn(async () => ({ status: "success" })) }));
vi.mock("@/server/pipeline", () => pipeline);

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
});
beforeEach(async () => {
  await resetTestDb(db);
  vi.clearAllMocks();
});

function fileForm(name = "receipt.pdf", bytes: BlobPart = "%PDF-1.7") {
  const form = new FormData();
  form.append("file", new File([bytes], name, { type: "application/pdf" }));
  return form;
}

describe("upload", () => {
  it("stores the file, creates a PENDING document, queues processing and counts usage", async () => {
    const { user, token } = await createUser(db);
    const res = await call(upload, "POST", "/upload", { token, body: fileForm() });

    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ message: "Document received!", status: "PENDING" });
    expect(storage.uploadToStorage).toHaveBeenCalledWith(expect.any(Uint8Array), "receipt.pdf");

    const [doc] = await db.select().from(documents).where(eq(documents.id, res.json.document_id));
    expect(doc).toMatchObject({ ownerId: user.id, s3Url: "https://bucket.test/receipt.pdf", status: "PENDING", quickbooksSynced: false });

    await flushBackground();
    expect(pipeline.processDocument).toHaveBeenCalledWith(doc.id);
    const [usage] = await db.select().from(usageRecords);
    expect(usage).toMatchObject({ userId: user.id, documentsProcessed: 1, month: currentMonth() });
  });

  it("enforces the free tier's 10 documents a month", async () => {
    const { user, token } = await createUser(db);
    await db.insert(usageRecords).values({ userId: user.id, month: currentMonth(), documentsProcessed: 10 });
    const res = await call(upload, "POST", "/upload", { token, body: fileForm() });
    expect(res.status).toBe(403);
    expect(res.json.detail).toMatchObject({ error: "limit_exceeded", limit: 10 });
    expect(storage.uploadToStorage).not.toHaveBeenCalled();
  });

  it("doesn't limit Pro", async () => {
    const { user, token } = await createUser(db, { plan: "pro" });
    await db.insert(usageRecords).values({ userId: user.id, month: currentMonth(), documentsProcessed: 50 });
    expect((await call(upload, "POST", "/upload", { token, body: fileForm() })).status).toBe(200);
    expect((await db.select().from(usageRecords))[0].documentsProcessed).toBe(51);
  });

  it("requires a file and rejects oversized ones", async () => {
    const { token } = await createUser(db);
    expect((await call(upload, "POST", "/upload", { token, body: new FormData() })).status).toBe(422);
    expect((await call(upload, "POST", "/upload", { token, body: "not multipart" })).status).toBe(422);
    const big = fileForm("big.pdf", new Uint8Array(10 * 1024 * 1024 + 1));
    expect((await call(upload, "POST", "/upload", { token, body: big })).status).toBe(413);
  });

  it("enforces the same file-type rules as the upload forms", async () => {
    const { token } = await createUser(db);
    const exe = await call(upload, "POST", "/upload", { token, body: fileForm("invoice.exe") });
    expect(exe).toMatchObject({ status: 400, json: { detail: expect.stringMatching(/^Unsupported file extension/) } });

    const form = new FormData();
    form.append("file", new File(["<svg/>"], "receipt.png", { type: "image/svg+xml" }));
    expect((await call(upload, "POST", "/upload", { token, body: form })).status).toBe(400);
    expect(storage.uploadToStorage).not.toHaveBeenCalled();
    expect(await db.select().from(usageRecords)).toEqual([]);
  });

  it("requires authentication", async () => {
    expect((await call(upload, "POST", "/upload", { body: fileForm() })).status).toBe(401);
  });
});

describe("documents", () => {
  it("lists only the caller's documents, newest first", async () => {
    const { user, token } = await createUser(db);
    const other = await createUser(db, { username: "other@test.com" });
    await createDocument(db, { ownerId: user.id, filename: "old.pdf", createdAt: new Date("2026-01-01T00:00:00Z") });
    await createDocument(db, { ownerId: user.id, filename: "new.pdf", createdAt: new Date("2026-02-01T00:00:00Z") });
    await createDocument(db, { ownerId: other.user.id, filename: "theirs.pdf" });

    const res = await call(listDocuments, "GET", "/documents", { token });
    expect(res.json.map((d: { filename: string }) => d.filename)).toEqual(["new.pdf", "old.pdf"]);
    expect(res.json[0]).toMatchObject({ status: "COMPLETED", quickbooks_synced: false, flags: null, created_at: "2026-02-01T00:00:00.000Z" });
  });

  it("deletes a document with its extraction and file", async () => {
    const { user, token } = await createUser(db);
    const { doc } = await createDocument(db, { ownerId: user.id, filename: "test.pdf", extraction: { extractedData: { invoice_number: "123" } } });

    const res = await call(deleteDocument, "DELETE", `/documents/${doc.id}`, { token, params: { documentId: doc.id } });
    expect(res.status).toBe(204);
    expect(await db.select().from(documents)).toEqual([]);
    expect(await db.select().from(extractions)).toEqual([]);
    expect(storage.deleteFromStorage).toHaveBeenCalledWith("test.pdf");
  });

  it("won't delete someone else's document", async () => {
    const { token } = await createUser(db);
    const other = await createUser(db, { username: "other@test.com" });
    const { doc } = await createDocument(db, { ownerId: other.user.id });
    expect((await call(deleteDocument, "DELETE", `/documents/${doc.id}`, { token, params: { documentId: doc.id } })).status).toBe(404);
    expect((await call(deleteDocument, "DELETE", "/documents/x")).status).toBe(401);
  });
});

describe("extraction", () => {
  it("returns the extraction with its vendor and currency fields", async () => {
    const { user, token } = await createUser(db);
    const [vendor] = await db.insert(vendors).values({ userId: user.id, canonicalName: "Test Vendor", aliases: ["TV"] }).returning();
    const { doc } = await createDocument(db, {
      ownerId: user.id,
      extraction: {
        extractedData: { vendor: "Test Vendor", total_amount: "£50.00" },
        category: "Meals",
        vendorId: vendor.id,
        originalCurrency: "GBP",
        originalAmount: 50,
        convertedAmount: 63.25,
        convertedCurrency: "USD",
        exchangeRate: 1.265,
      },
    });

    const res = await call(getExtraction, "GET", `/extraction/${doc.id}`, { token, params: { documentId: doc.id } });
    expect(res.json).toMatchObject({
      document_id: doc.id,
      extracted_data: { vendor: "Test Vendor", total_amount: "£50.00" },
      confidence_score: 0.98,
      category: "Meals",
      vendor: { id: vendor.id, canonical_name: "Test Vendor", aliases: ["TV"] },
      original_currency: "GBP",
      original_amount: 50,
      converted_amount: 63.25,
      converted_currency: "USD",
      exchange_rate: 1.265,
    });
  });

  it("returns legacy extractions without currency fields", async () => {
    const { user, token } = await createUser(db);
    const { doc } = await createDocument(db, { ownerId: user.id, extraction: { extractedData: { vendor: "Legacy", total_amount: "$50.00" } } });
    const res = await call(getExtraction, "GET", `/extraction/${doc.id}`, { token, params: { documentId: doc.id } });
    expect(res.json).toMatchObject({ vendor: null, original_currency: null, converted_amount: null, exchange_rate: null });
  });

  it("404s while processing and for other users' documents", async () => {
    const { user, token } = await createUser(db);
    const other = await createUser(db, { username: "other@test.com" });
    const pending = await createDocument(db, { ownerId: user.id, status: "PENDING", extraction: null });
    const theirs = await createDocument(db, { ownerId: other.user.id });
    for (const id of [pending.doc.id, theirs.doc.id]) {
      expect((await call(getExtraction, "GET", `/extraction/${id}`, { token, params: { documentId: id } })).status).toBe(404);
    }
  });

  it("lets Pro users recategorise their own extractions", async () => {
    const free = await createUser(db);
    const pro = await createUser(db, { username: "pro@test.com", plan: "pro" });
    const { doc, ext } = await createDocument(db, { ownerId: pro.user.id, extraction: { category: "Other" } });
    const theirs = await createDocument(db, { ownerId: free.user.id });
    const patch = (token: string, id: string, body: unknown) =>
      call(updateCategory, "PATCH", `/extraction/${id}/category`, { token, body, params: { documentId: id } });

    expect((await patch(free.token, theirs.doc.id, { category: "Travel" })).status).toBe(403);
    expect((await patch(pro.token, theirs.doc.id, { category: "Travel" })).status).toBe(404);
    expect((await patch(pro.token, doc.id, { category: "Snacks" })).status).toBe(400);
    expect((await patch(pro.token, doc.id, "nope")).status).toBe(400);

    const ok = await patch(pro.token, doc.id, { category: "Travel" });
    expect(ok.json).toEqual({ message: "Category updated", category: "Travel" });
    expect((await db.select().from(extractions).where(eq(extractions.id, ext!.id)))[0].category).toBe("Travel");
  });
});

describe("tax summary CSV", () => {
  it("is Pro-only and needs a year", async () => {
    const free = await createUser(db);
    const pro = await createUser(db, { username: "pro@test.com", plan: "pro" });
    expect((await call(taxSummary, "GET", "/reports/tax-summary?year=2026", { token: free.token })).status).toBe(403);
    expect((await call(taxSummary, "GET", "/reports/tax-summary", { token: pro.token })).status).toBe(422);
    expect((await call(taxSummary, "GET", "/reports/tax-summary?year=abc", { token: pro.token })).status).toBe(422);
  });

  it("only totals amounts converted into the current base currency, even when the currency column is missing", async () => {
    const { user, token } = await createUser(db, { plan: "pro" });
    // Legacy row: converted_amount from before converted_currency existed. Dashboard and analytics
    // (reliableAmount) exclude it, so the tax export must not add it to the USD totals either.
    await createDocument(db, { ownerId: user.id, extraction: { extractedData: { vendor: "Old", date: "2026-02-02" }, category: "Meals", convertedAmount: 40, convertedCurrency: null } });
    const lines = (await call(taxSummary, "GET", "/reports/tax-summary?year=2026", { token })).text.split("\r\n");
    expect(lines).toContain("2026-02-02,Old,Meals,0.00,USD,N/A,N/A");
    expect(lines).not.toContain("Meals,40.00");
    expect(lines).toContain("NOTE: 1 document(s) excluded from the summary above");
  });

  it("totals converted amounts per category and lists stale rows separately", async () => {
    const { user, token } = await createUser(db, { plan: "pro" });
    const add = (extraction: Parameters<typeof createDocument>[1]["extraction"]) => createDocument(db, { ownerId: user.id, extraction });
    await add({ extractedData: { vendor: "Air, Inc", date: "2026-03-02", total_amount: "€1,000" }, category: "Travel", originalAmount: 1000, originalCurrency: "EUR", convertedAmount: 1085, convertedCurrency: "USD", exchangeRate: 1.085 });
    await add({ extractedData: { vendor: "Cafe", date: "2026-01-15" }, category: "Meals", originalAmount: 12.5, originalCurrency: "USD", convertedAmount: 12.5, convertedCurrency: "USD", exchangeRate: 1 });
    await add({ extractedData: { vendor: "Cafe", date: "2026-01-20" }, category: "Meals", originalAmount: 7.5, originalCurrency: "USD", convertedAmount: 7.5, convertedCurrency: "USD", exchangeRate: 1 });
    await add({ extractedData: { vendor: "Stale", date: "2026-05-01" }, category: "Software", originalAmount: 20, originalCurrency: "GBP", convertedAmount: 21, convertedCurrency: "EUR", exchangeRate: 1.05 });
    await add({ extractedData: { vendor: "Legacy", date: "2026-06-01", total_amount: "$9.99" }, category: "Software" });
    await add({ extractedData: { vendor: "Last year", date: "2025-12-31" }, category: "Meals", convertedAmount: 5, convertedCurrency: "USD" });
    // Regression: only YYYY-MM-DD dates used to count, so this one silently vanished from the export
    // even though analytics (same parser) counts it in 2026.
    await add({ extractedData: { vendor: "US date", date: "12/31/2026" }, category: "Meals", originalAmount: 5, originalCurrency: "USD", convertedAmount: 5, convertedCurrency: "USD", exchangeRate: 1 });
    await add({ extractedData: { vendor: "Uncategorised", date: "2026-02-01" }, convertedAmount: 5, convertedCurrency: "USD" });
    // No invoice date: falls back to the upload date, like analytics and the dashboard.
    await createDocument(db, {
      ownerId: user.id,
      createdAt: new Date("2026-04-10T12:00:00Z"),
      extraction: { extractedData: { vendor: "Undated" }, category: "Software", originalAmount: 30, originalCurrency: "USD", convertedAmount: 30, convertedCurrency: "USD", exchangeRate: 1 },
    });

    const res = await call(taxSummary, "GET", "/reports/tax-summary?year=2026", { token });
    expect(res.headers.get("content-disposition")).toBe("attachment; filename=Tallyhawk_Tax_Summary_2026.csv");
    expect(res.text.split("\r\n")).toEqual([
      "Date,Vendor,Category,Original Amount,Original Currency,Converted Amount (USD),Exchange Rate",
      "2026-01-15,Cafe,Meals,12.50,USD,12.50,1.000000",
      "2026-01-20,Cafe,Meals,7.50,USD,7.50,1.000000",
      '2026-03-02,"Air, Inc",Travel,"1,000.00",EUR,"1,085.00",1.085000',
      "2026-04-10,Undated,Software,30.00,USD,30.00,1.000000",
      "2026-05-01,Stale,Software,20.00,GBP,N/A,N/A", // its GBP→EUR rate says nothing about USD
      "2026-06-01,Legacy,Software,9.99,USD,N/A,N/A",
      "2026-12-31,US date,Meals,5.00,USD,5.00,1.000000",
      "",
      "SUMMARY BY CATEGORY",
      "Category,Total (USD)",
      "Meals,25.00",
      "Software,30.00",
      'Travel,"1,085.00"',
      "",
      "NOTE: 2 document(s) excluded from the summary above",
      '"because they have no up-to-date conversion into USD yet (no exchange rate was available, or your base currency changed after they were processed)."',
      "Date,Vendor,Original Amount,Original Currency",
      "2026-05-01,Stale,20.00,GBP",
      "2026-06-01,Legacy,9.99,USD",
      "",
    ]);
  });
});
