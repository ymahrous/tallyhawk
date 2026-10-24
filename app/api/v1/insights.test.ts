// @vitest-environment node
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/server/db";
import { documents, extractions, usageRecords, vendors } from "@/server/db/schema";
import { call, createDocument, createTestDb, createUser, resetTestDb } from "@/test/server";
import { GET as monthlyTrend } from "./analytics/monthly-trend/route";
import { GET as byCategory } from "./analytics/spend-by-category/route";
import { GET as byVendor } from "./analytics/spend-by-vendor/route";
import { GET as dashboard } from "./stats/dashboard/route";
import { POST as merge } from "./vendors/[vendorId]/merge/route";
import { PATCH as rename } from "./vendors/[vendorId]/rename/route";
import { GET as listVendors } from "./vendors/route";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
});
beforeEach(() => resetTestDb(db));

async function spend(ownerId: string, rows: { date?: string; uploaded?: string; amount: number; currency?: string; category?: string; vendorId?: string; status?: string }[]) {
  for (const r of rows) {
    await createDocument(db, {
      ownerId,
      status: r.status ?? "COMPLETED",
      createdAt: r.uploaded ? new Date(r.uploaded) : undefined,
      extraction: { extractedData: r.date ? { date: r.date } : {}, convertedAmount: r.amount, convertedCurrency: r.currency ?? "USD", category: r.category ?? null, vendorId: r.vendorId ?? null },
    });
  }
}

describe("dashboard stats", () => {
  it("counts lifetime usage, synced docs, and this month's reliable spend", async () => {
    const { user, token } = await createUser(db);
    const now = new Date();
    const thisMonth = (day: number) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day)).toISOString().slice(0, 10);
    await db.insert(usageRecords).values([
      { userId: user.id, month: new Date(Date.UTC(2025, 0, 1)), documentsProcessed: 4 },
      { userId: user.id, month: new Date(Date.UTC(2025, 1, 1)), documentsProcessed: 2 },
    ]);
    await spend(user.id, [
      { date: thisMonth(1), amount: 10.1 },
      { date: thisMonth(1), amount: 5.2 },
      { date: thisMonth(1), amount: 99, currency: "EUR" }, // stale currency → excluded
      { date: "2020-01-01", amount: 1000 }, // other month
      { amount: 1.25, uploaded: now.toISOString() }, // no invoice date → upload date (this month)
      { date: thisMonth(1), amount: 50, status: "FAILED" },
    ]);
    const { doc: synced } = await createDocument(db, { ownerId: user.id, extraction: null });
    await db.update(documents).set({ quickbooksSynced: true }).where(eq(documents.id, synced.id));

    expect((await call(dashboard, "GET", "/stats/dashboard", { token })).json).toEqual({ processed: 6, synced: 1, month_spend: 16.55, base_currency: "USD", excluded_from_month_spend: 1 });
  });

  it("is zero for a new user", async () => {
    const { token } = await createUser(db);
    expect((await call(dashboard, "GET", "/stats/dashboard", { token })).json).toEqual({ processed: 0, synced: 0, month_spend: 0, base_currency: "USD", excluded_from_month_spend: 0 });
  });
});

describe("analytics", () => {
  it("is Pro-only and validates the period", async () => {
    const free = await createUser(db);
    const pro = await createUser(db, { username: "pro@test.com", plan: "pro" });
    expect((await call(byCategory, "GET", "/analytics/spend-by-category?year=2026", { token: free.token })).status).toBe(403);
    expect((await call(byVendor, "GET", "/analytics/spend-by-vendor?year=2026", { token: free.token })).status).toBe(403);
    expect((await call(monthlyTrend, "GET", "/analytics/monthly-trend?year=2026", { token: free.token })).status).toBe(403);
    expect((await call(byCategory, "GET", "/analytics/spend-by-category", { token: pro.token })).status).toBe(422);
  });

  it("aggregates reliable spend by category, vendor and month", async () => {
    const { user, token } = await createUser(db, { plan: "pro" });
    const [aws] = await db.insert(vendors).values({ userId: user.id, canonicalName: "AWS" }).returning();
    const [figma] = await db.insert(vendors).values({ userId: user.id, canonicalName: "Figma" }).returning();
    await spend(user.id, [
      { date: "2026-01-10", amount: 100, category: "Software", vendorId: aws.id },
      { date: "01/20/2026", amount: 50.5, category: "Software", vendorId: aws.id },
      { date: "2026-02-03", amount: 15, category: "Software", vendorId: figma.id },
      { date: "2026-02-04", amount: 20 },
      { date: "2026-02-05", amount: 999, currency: "EUR", category: "Software", vendorId: aws.id },
      { date: "2025-02-05", amount: 7, category: "Meals" },
    ]);

    expect((await call(byCategory, "GET", "/analytics/spend-by-category?year=2026", { token })).json).toEqual([
      { name: "Software", value: 165.5 },
      { name: "Uncategorized", value: 20 },
    ]);
    expect((await call(byCategory, "GET", "/analytics/spend-by-category?year=2026&month=2", { token })).json).toEqual([
      { name: "Software", value: 15 },
      { name: "Uncategorized", value: 20 },
    ]);
    expect((await call(byVendor, "GET", "/analytics/spend-by-vendor?year=2026", { token })).json).toEqual([
      { name: "AWS", value: 150.5 },
      { name: "Unknown", value: 20 },
      { name: "Figma", value: 15 },
    ]);
    expect((await call(monthlyTrend, "GET", "/analytics/monthly-trend?year=2026", { token })).json).toEqual([
      { month: "2026-01", spend: 150.5 },
      { month: "2026-02", spend: 35 },
    ]);
  });
});

describe("vendors", () => {
  it("lists only the caller's vendors", async () => {
    const { user, token } = await createUser(db);
    const other = await createUser(db, { username: "o@test.com" });
    await db.insert(vendors).values([
      { userId: user.id, canonicalName: "Mine", aliases: ["MINE"] },
      { userId: other.user.id, canonicalName: "Theirs" },
    ]);
    const res = await call(listVendors, "GET", "/vendors", { token });
    expect(res.json).toHaveLength(1);
    expect(res.json[0]).toMatchObject({ user_id: user.id, canonical_name: "Mine", aliases: ["MINE"] });
  });

  it("renames, keeping the old name as an alias and updating extractions", async () => {
    const { user, token } = await createUser(db);
    const [v] = await db.insert(vendors).values({ userId: user.id, canonicalName: "AMZN MKTP" }).returning();
    const { ext } = await createDocument(db, { ownerId: user.id, extraction: { vendorId: v.id, extractedData: { vendor: "AMZN MKTP", total_amount: "$5" } } });

    const res = await call(rename, "PATCH", `/vendors/${v.id}/rename`, { token, body: { new_name: "Amazon" }, params: { vendorId: v.id } });
    expect(res.json).toMatchObject({ id: v.id, canonical_name: "Amazon", aliases: ["AMZN MKTP"] });
    expect((await db.select().from(extractions).where(eq(extractions.id, ext!.id)))[0].extractedData).toEqual({ vendor: "Amazon", total_amount: "$5" });

    // Renaming back and forth neither duplicates aliases nor lists the canonical name as its own alias.
    const there = await call(rename, "PATCH", `/vendors/${v.id}/rename`, { token, body: { new_name: "AMZN MKTP" }, params: { vendorId: v.id } });
    expect(there.json).toMatchObject({ canonical_name: "AMZN MKTP", aliases: ["Amazon"] });
    const back = await call(rename, "PATCH", `/vendors/${v.id}/rename`, { token, body: { new_name: "Amazon" }, params: { vendorId: v.id } });
    expect(back.json.aliases).toEqual(["AMZN MKTP"]);
  });

  it("rejects empty names and names another vendor already uses (regression: a 500)", async () => {
    const { user, token } = await createUser(db);
    const [aws] = await db.insert(vendors).values({ userId: user.id, canonicalName: "AWS" }).returning();
    await db.insert(vendors).values({ userId: user.id, canonicalName: "Amazon" });
    const rename_ = (new_name: string) => call(rename, "PATCH", `/vendors/${aws.id}/rename`, { token, body: { new_name }, params: { vendorId: aws.id } });

    expect((await rename_("   ")).status).toBe(422);
    expect(await rename_("Amazon")).toMatchObject({ status: 400, json: { detail: "Another vendor already has that name. Merge the two vendors instead." } });
    expect((await rename_("  AWS Inc  ")).json.canonical_name).toBe("AWS Inc");
  });

  it("merges a vendor into another", async () => {
    const { user, token } = await createUser(db);
    const [source] = await db.insert(vendors).values({ userId: user.id, canonicalName: "AWS EMEA", aliases: ["aws", "Amazon Web Services"] }).returning();
    const [target] = await db.insert(vendors).values({ userId: user.id, canonicalName: "Amazon Web Services", aliases: ["AWS"] }).returning();
    const { ext } = await createDocument(db, { ownerId: user.id, extraction: { vendorId: source.id, extractedData: { vendor: "AWS EMEA" } } });

    const res = await call(merge, "POST", `/vendors/${source.id}/merge`, { token, body: { target_vendor_id: target.id }, params: { vendorId: source.id } });
    expect(res.json.message).toBe("Vendors merged successfully");
    // "aws" is already known as "AWS" and "Amazon Web Services" is the target's own name.
    expect(res.json.surviving_vendor).toMatchObject({ id: target.id, aliases: ["AWS", "AWS EMEA"] });
    expect(await db.select().from(vendors)).toHaveLength(1);
    expect((await db.select().from(extractions).where(eq(extractions.id, ext!.id)))[0]).toMatchObject({ vendorId: target.id, extractedData: { vendor: "Amazon Web Services" } });
  });

  it("404s on other users' vendors and self-merges", async () => {
    const { user, token } = await createUser(db);
    const other = await createUser(db, { username: "o@test.com" });
    const [mine] = await db.insert(vendors).values({ userId: user.id, canonicalName: "Mine" }).returning();
    const [theirs] = await db.insert(vendors).values({ userId: other.user.id, canonicalName: "Theirs" }).returning();
    expect((await call(rename, "PATCH", `/vendors/${theirs.id}/rename`, { token, body: { new_name: "x" }, params: { vendorId: theirs.id } })).status).toBe(404);
    expect((await call(merge, "POST", `/vendors/${mine.id}/merge`, { token, body: { target_vendor_id: theirs.id }, params: { vendorId: mine.id } })).status).toBe(404);
    expect((await call(merge, "POST", `/vendors/${mine.id}/merge`, { token, body: { target_vendor_id: mine.id }, params: { vendorId: mine.id } })).status).toBe(404);
    expect(await db.select().from(vendors)).toHaveLength(2);
  });
});
