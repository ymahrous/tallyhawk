// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "./db";
import { documents, extractions, vendors } from "./db/schema";
import { processDocument, reconvertUserCurrency, reconvertUserExtractions } from "./pipeline";
import { matchOrCreateVendor } from "./vendors";
import { createDocument, createTestDb, createUser, resetTestDb, stubFetch } from "@/test/server";

const ai = vi.hoisted(() => ({ runAiExtraction: vi.fn() }));
vi.mock("./ai", () => ai);

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
});
beforeEach(async () => {
  await resetTestDb(db);
  vi.clearAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.unstubAllEnvs());

/** Exchange-rate API fake: rates are "from→to". */
function rates(table: Record<string, number>) {
  vi.stubEnv("EXCHANGE_RATE_API_KEY", "k");
  return stubFetch((url) => {
    const [, , , , , , from, to, amount] = url.split("/");
    const rate = table[`${from}→${to}`];
    if (rate === undefined) return Response.json({ result: "error", "error-type": "unsupported-code" });
    return Response.json({ result: "success", conversion_rate: rate, conversion_result: Number(amount) * rate });
  });
}

function extracted(data: Record<string, unknown>) {
  ai.runAiExtraction.mockResolvedValueOnce({ data, source: "google_gemini-2.5-flash", confidence: 0.98 });
}

async function pendingDoc(ownerId: string) {
  return (await createDocument(db, { ownerId, status: "PENDING", extraction: null })).doc;
}

describe("processDocument", () => {
  it("extracts, converts into the base currency, matches a vendor and completes", async () => {
    rates({ "EUR→USD": 1.085 });
    const { user } = await createUser(db);
    const doc = await pendingDoc(user.id);
    extracted({ vendor: "Lufthansa", total_amount: "€1.000,00", currency: "eur", date: "2026-03-02", category: "Travel" });

    expect(await processDocument(doc.id)).toEqual({ status: "success", documentId: doc.id });
    expect(ai.runAiExtraction).toHaveBeenCalledWith(doc.s3Url);

    const [d] = await db.select().from(documents).where(eq(documents.id, doc.id));
    expect(d.status).toBe("COMPLETED");
    const [ext] = await db.select().from(extractions).where(eq(extractions.documentId, doc.id));
    // "€1.000,00" → digits/dots only → 1.00000 → 1 (same parsing as the Python worker)
    expect(ext).toMatchObject({ category: "Travel", originalCurrency: "EUR", originalAmount: 1, convertedAmount: 1.09, convertedCurrency: "USD", exchangeRate: 1.085, confidenceScore: 0.98 });
    const [v] = await db.select().from(vendors);
    expect(v).toMatchObject({ canonicalName: "Lufthansa", userId: user.id });
    expect(ext.vendorId).toBe(v.id);
  });

  it("leaves converted fields empty when no rate is available, instead of faking 1.0", async () => {
    vi.stubEnv("EXCHANGE_RATE_API_KEY", "");
    const { user } = await createUser(db);
    const doc = await pendingDoc(user.id);
    extracted({ vendor: "Shop", total_amount: "£20", currency: "GBP" });

    await processDocument(doc.id);
    const [ext] = await db.select().from(extractions).where(eq(extractions.documentId, doc.id));
    expect(ext).toMatchObject({ originalAmount: 20, originalCurrency: "GBP", convertedAmount: null, convertedCurrency: null, exchangeRate: null, category: "Other" });
  });

  it("marks the document FAILED when extraction throws", async () => {
    const { user } = await createUser(db);
    const doc = await pendingDoc(user.id);
    ai.runAiExtraction.mockRejectedValueOnce(new Error("Gemini down"));

    expect((await processDocument(doc.id)).status).toBe("failed");
    expect((await db.select().from(documents))[0].status).toBe("FAILED");
    expect(await db.select().from(extractions)).toEqual([]);
  });

  it("fails on unparseable amounts, like the Python float()", async () => {
    const { user } = await createUser(db);
    const doc = await pendingDoc(user.id);
    extracted({ vendor: "X", total_amount: "1.2.3" });
    expect((await processDocument(doc.id)).status).toBe("failed");
  });

  it("reports a missing document", async () => {
    expect(await processDocument("nope")).toMatchObject({ status: "failed", error: "Document not found" });
  });

  it("flags a possible duplicate: same vendor and amount within 30 days", async () => {
    const { user } = await createUser(db);
    await createDocument(db, { ownerId: user.id, extraction: { extractedData: { vendor: "Adobe Inc" }, convertedAmount: 54.99, convertedCurrency: "USD" } });
    const doc = await pendingDoc(user.id);
    extracted({ vendor: "Adobe", total_amount: "$54.99", currency: "USD" });

    await processDocument(doc.id);
    expect((await db.select().from(documents).where(eq(documents.id, doc.id)))[0].flags).toBe("possible_duplicate");
  });

  it("ignores old and other-currency documents when looking for duplicates", async () => {
    const { user } = await createUser(db);
    await createDocument(db, { ownerId: user.id, createdAt: new Date(Date.now() - 40 * 86400_000), extraction: { extractedData: { vendor: "Adobe" }, convertedAmount: 54.99, convertedCurrency: "USD" } });
    await createDocument(db, { ownerId: user.id, extraction: { extractedData: { vendor: "Adobe" }, convertedAmount: 54.99, convertedCurrency: "EUR" } });
    const doc = await pendingDoc(user.id);
    extracted({ vendor: "Adobe", total_amount: "$54.99", currency: "USD" });

    await processDocument(doc.id);
    expect((await db.select().from(documents).where(eq(documents.id, doc.id)))[0].flags).toBeNull();
  });

  it("never matches documents without a vendor (regression: '' is contained in every name)", async () => {
    const { user } = await createUser(db);
    for (const amount of [54.99, 10, 12]) {
      await createDocument(db, { ownerId: user.id, extraction: { extractedData: { vendor: "" }, convertedAmount: amount, convertedCurrency: "USD" } });
    }
    const doc = await pendingDoc(user.id);
    extracted({ vendor: "Adobe", total_amount: "$54.99", currency: "USD" });

    await processDocument(doc.id);
    expect((await db.select().from(documents).where(eq(documents.id, doc.id)))[0].flags).toBeNull();
  });

  it("flags a price anomaly above 3× the vendor's average", async () => {
    const { user } = await createUser(db);
    for (const amount of [10, 12]) {
      await createDocument(db, { ownerId: user.id, createdAt: new Date(Date.now() - 60 * 86400_000), extraction: { extractedData: { vendor: "AWS" }, convertedAmount: amount, convertedCurrency: "USD" } });
    }
    const doc = await pendingDoc(user.id);
    extracted({ vendor: "AWS", total_amount: "$100", currency: "USD" });

    await processDocument(doc.id);
    expect((await db.select().from(documents).where(eq(documents.id, doc.id)))[0].flags).toBe("price_anomaly");
  });
});

describe("matchOrCreateVendor", () => {
  it("fuzzy-matches existing vendors and remembers the spelling as an alias", async () => {
    const { user } = await createUser(db);
    const created = await matchOrCreateVendor(db, user.id, "  Amazon Web Services ");
    expect(created).toMatchObject({ canonicalName: "Amazon Web Services", aliases: [] });

    const matched = await matchOrCreateVendor(db, user.id, "Amazon Web Service");
    expect(matched!.id).toBe(created!.id);
    expect(matched!.aliases).toEqual(["Amazon Web Service"]);
    // Persisted (the Python version mutated the JSON list without flag_modified, so it never saved).
    expect((await db.select().from(vendors))[0].aliases).toEqual(["Amazon Web Service"]);

    expect((await matchOrCreateVendor(db, user.id, "amazon web services"))!.aliases).toEqual(["Amazon Web Service"]);
    expect((await matchOrCreateVendor(db, user.id, "Stripe"))!.id).not.toBe(created!.id);
    expect(await matchOrCreateVendor(db, user.id, "   ")).toBeNull();
    expect(await db.select().from(vendors)).toHaveLength(2);
  });

  it("keeps each user's vendors separate", async () => {
    const a = await createUser(db);
    const b = await createUser(db, { username: "b@test.com" });
    const va = await matchOrCreateVendor(db, a.user.id, "Figma");
    const vb = await matchOrCreateVendor(db, b.user.id, "Figma");
    expect(va!.id).not.toBe(vb!.id);
  });
});

describe("reconvertUserExtractions", () => {
  it("re-converts known originals into the new base currency, one lookup per currency", async () => {
    const fetchMock = rates({ "USD→EUR": 0.9, "GBP→EUR": 1.2 });
    const { user } = await createUser(db, { baseCurrency: "EUR" });
    const add = (extraction: Parameters<typeof createDocument>[1]["extraction"], status = "COMPLETED") =>
      createDocument(db, { ownerId: user.id, status, extraction });
    const usd1 = await add({ originalAmount: 100, originalCurrency: "USD", convertedAmount: 100, convertedCurrency: "USD", exchangeRate: 1 });
    const usd2 = await add({ originalAmount: 10, originalCurrency: "USD", convertedAmount: 10, convertedCurrency: "USD", exchangeRate: 1 });
    const gbp = await add({ originalAmount: 50, originalCurrency: "GBP", convertedAmount: null, convertedCurrency: null });
    const done = await add({ originalAmount: 5, originalCurrency: "USD", convertedAmount: 4.5, convertedCurrency: "EUR", exchangeRate: 0.9 });
    const legacy = await add({ extractedData: { total_amount: "$5" } });
    const failed = await add({ originalAmount: 1, originalCurrency: "USD" }, "FAILED");

    expect(await reconvertUserExtractions(db, user.id, "EUR")).toBe(3);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const get = async (id: string) => (await db.select().from(extractions).where(eq(extractions.id, id)))[0];
    expect(await get(usd1.ext!.id)).toMatchObject({ convertedAmount: 90, convertedCurrency: "EUR", exchangeRate: 0.9 });
    expect(await get(usd2.ext!.id)).toMatchObject({ convertedAmount: 9, convertedCurrency: "EUR" });
    expect(await get(gbp.ext!.id)).toMatchObject({ convertedAmount: 60, convertedCurrency: "EUR", exchangeRate: 1.2 });
    expect(await get(done.ext!.id)).toMatchObject({ convertedAmount: 4.5 });
    expect(await get(legacy.ext!.id)).toMatchObject({ convertedAmount: null, convertedCurrency: null });
    expect(await get(failed.ext!.id)).toMatchObject({ convertedAmount: null });
  });

  it("leaves rows stale (never fabricated) when a rate is unavailable", async () => {
    rates({ "USD→EUR": 0.9 });
    const { user } = await createUser(db, { baseCurrency: "EUR" });
    const { ext } = await createDocument(db, { ownerId: user.id, extraction: { originalAmount: 50, originalCurrency: "JPY", convertedAmount: 0.33, convertedCurrency: "USD" } });

    expect(await reconvertUserExtractions(db, user.id, "EUR")).toBe(0);
    expect((await db.select().from(extractions).where(eq(extractions.id, ext!.id)))[0]).toMatchObject({ convertedCurrency: "USD" });
  });

  it("reads the base currency at execution time", async () => {
    rates({ "USD→CAD": 1.4 });
    const { user } = await createUser(db, { baseCurrency: "CAD" });
    await createDocument(db, { ownerId: user.id, extraction: { originalAmount: 10, originalCurrency: "USD", convertedAmount: 10, convertedCurrency: "USD" } });
    expect(await reconvertUserCurrency(user.id)).toBe(1);
    expect(await reconvertUserCurrency("missing")).toBeNull();
  });
});
