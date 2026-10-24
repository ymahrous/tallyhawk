// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/server/db";
import { auditLog, contactMessages, deletedAccounts, feedback, passwordResetTokens, rateLimits, stripeEvents } from "@/server/db/schema";
import { call, createTestDb, createUser, resetTestDb } from "@/test/server";
import { RETENTION } from "@/lib/retention";
import { applyRetention } from "./retention";
import { GET as cron } from "@/app/api/v1/cron/retention/route";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
});
beforeEach(() => resetTestDb(db));
afterEach(() => vi.unstubAllEnvs());

const NOW = new Date("2030-06-15T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
/** `days` before NOW, nudged by `offsetMs` (negative = older). */
const daysAgo = (days: number, offsetMs = 0) => new Date(NOW.getTime() - days * DAY + offsetMs);
const JUST_OLDER = -60_000;
const JUST_NEWER = 60_000;

describe("retention job", () => {
  it("anonymizes deletion records (and audit entries about them) after the identifiers period, and keeps them", async () => {
    const days = RETENTION.deletionRecordIdentifiersDays;
    await db.insert(deletedAccounts).values([
      { userId: "recent", username: "recent@example.com", role: "user", deletedBy: "self", deletedAt: daysAgo(days, JUST_NEWER), stripeSubscriptionId: "sub_r" },
      {
        userId: "due",
        username: "due@example.com",
        role: "user",
        plan: "pro",
        deletedBy: "admin",
        deletedByAdminUsername: "admin@tallyhawk.test",
        deletedAt: daysAgo(days, JUST_OLDER),
        stripeCustomerId: "cus_d",
        stripeSubscriptionId: "sub_d",
        subscriptionStatusAtDeletion: "active",
        subscriptionStatus: "canceled",
        lifetimeDocuments: 12,
      },
    ]);
    await db.insert(auditLog).values([
      { actorUsername: "admin@tallyhawk.test", action: "user.delete", targetType: "user", targetId: "due", targetLabel: "due@example.com", ipHash: "abc", createdAt: daysAgo(days) },
      { actorUsername: "admin@tallyhawk.test", action: "user.update", targetType: "user", targetId: "recent", targetLabel: "recent@example.com", createdAt: daysAgo(10) },
    ]);

    const result = await applyRetention(db, NOW);
    expect(result).toMatchObject({ deletion_records_anonymized: 1 });

    const due = (await db.select().from(deletedAccounts).where(eq(deletedAccounts.plan, "pro")))[0];
    // Identifiers gone; the anonymized facts stay.
    expect(due).toMatchObject({
      userId: null,
      username: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      anonymizedAt: NOW,
      role: "user",
      deletedBy: "admin",
      subscriptionStatusAtDeletion: "active",
      subscriptionStatus: "canceled",
      lifetimeDocuments: 12,
    });
    const recent = (await db.select().from(deletedAccounts).where(eq(deletedAccounts.userId, "recent")))[0];
    expect(recent.username).toBe("recent@example.com");

    // The email is gone from the audit log at the same time; other audit entries are untouched.
    const audit = await db.select().from(auditLog);
    expect(audit.find((a) => a.action === "user.delete")).toMatchObject({ targetLabel: null, targetId: null, ipHash: null, anonymizedAt: NOW });
    expect(audit.find((a) => a.action === "user.update")).toMatchObject({ targetLabel: "recent@example.com", anonymizedAt: null });

    // Idempotent: a second run changes nothing.
    expect(Object.values(await applyRetention(db, NOW)).every((n) => n === 0)).toBe(true);
  });

  it("anonymizes support messages and old audit entries, keeping their type, status and dates", async () => {
    const { user } = await createUser(db);
    const support = RETENTION.supportMessageDays;
    await db.insert(contactMessages).values([
      { name: "Old", email: "o@example.com", subject: "Refund", message: "m".repeat(10), userId: user.id, adminNote: "note", createdAt: daysAgo(support, JUST_OLDER) },
      { name: "New", email: "n@example.com", subject: "Hi", message: "m".repeat(10), createdAt: daysAgo(support, JUST_NEWER) },
    ]);
    await db.insert(feedback).values([
      { type: "Bug", message: "old crash", page: "/app", userId: user.id, status: "in_progress", createdAt: daysAgo(support, JUST_OLDER) },
      { type: "Bug", message: "new crash", createdAt: daysAgo(support, JUST_NEWER) },
    ]);
    await db.insert(auditLog).values([
      { actorUsername: "admin", action: "admin.create", targetType: "admin", targetLabel: "ops@tallyhawk.test", ipHash: "x", createdAt: daysAgo(RETENTION.auditLogIdentifiersDays, JUST_OLDER) },
      { actorUsername: "admin", action: "admin.create", targetType: "admin", targetLabel: "new@tallyhawk.test", createdAt: daysAgo(RETENTION.auditLogIdentifiersDays, JUST_NEWER) },
    ]);

    expect(await applyRetention(db, NOW)).toMatchObject({ contact_messages_anonymized: 1, feedback_anonymized: 1, audit_log_entries_anonymized: 1 });

    const contact = await db.select().from(contactMessages);
    expect(contact.find((m) => m.anonymizedAt)).toMatchObject({ name: null, email: null, subject: null, message: null, adminNote: null, userId: null, status: "archived" });
    expect(contact.find((m) => !m.anonymizedAt)?.name).toBe("New");
    const fb = await db.select().from(feedback);
    expect(fb.find((f) => f.anonymizedAt)).toMatchObject({ type: "Bug", message: null, page: null, userId: null, status: "archived" });
    expect(fb.find((f) => !f.anonymizedAt)?.message).toBe("new crash");
    const audit = await db.select().from(auditLog);
    expect(audit.find((a) => a.anonymizedAt)).toMatchObject({ action: "admin.create", actorUsername: "admin", targetLabel: null, ipHash: null });
    expect(audit).toHaveLength(2); // anonymized, not deleted
  });

  it("deletes what has no anonymized value: old Stripe event ids, dead reset links, stale counters", async () => {
    const { user } = await createUser(db);
    await db.insert(stripeEvents).values([
      { id: "evt_old", type: "invoice.paid", createdAt: daysAgo(RETENTION.stripeEventDays, JUST_OLDER) },
      { id: "evt_new", type: "invoice.paid", createdAt: daysAgo(RETENTION.stripeEventDays, JUST_NEWER) },
    ]);
    await db.insert(passwordResetTokens).values([
      { userId: user.id, token: "expired", expiresAt: new Date(NOW.getTime() - 1000) },
      { userId: user.id, token: "used", used: true, expiresAt: new Date(NOW.getTime() + 30 * 60_000) },
      { userId: user.id, token: "live", expiresAt: new Date(NOW.getTime() + 30 * 60_000) },
    ]);
    await db.insert(rateLimits).values([
      { key: "old", count: 3, windowStart: new Date(NOW.getTime() - RETENTION.rateLimitHours * 3600_000 - 1000) },
      { key: "open", count: 3, windowStart: new Date(NOW.getTime() - 60_000) },
    ]);

    expect(await applyRetention(db, NOW)).toEqual({
      deletion_records_anonymized: 0,
      contact_messages_anonymized: 0,
      feedback_anonymized: 0,
      audit_log_entries_anonymized: 0,
      stripe_events_deleted: 1,
      reset_links_deleted: 2,
      rate_limit_counters_deleted: 1,
    });
    expect((await db.select().from(stripeEvents)).map((e) => e.id)).toEqual(["evt_new"]);
    expect((await db.select().from(passwordResetTokens)).map((t) => t.token)).toEqual(["live"]);
    expect((await db.select().from(rateLimits)).map((r) => r.key)).toEqual(["open"]);
  });
});

describe("GET /cron/retention", () => {
  it("never runs without CRON_SECRET", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await call(cron, "GET", "/cron/retention", { headers: { authorization: "Bearer " } })).status).toBe(503);
  });

  it("requires the secret as a bearer token, then reports what it changed", async () => {
    vi.stubEnv("CRON_SECRET", "cron-secret-value");
    vi.spyOn(console, "info").mockImplementation(() => {});
    expect((await call(cron, "GET", "/cron/retention")).status).toBe(401);
    expect((await call(cron, "GET", "/cron/retention", { headers: { authorization: "Bearer wrong" } })).status).toBe(401);
    // A user's session token is not the cron secret.
    const { token } = await createUser(db);
    expect((await call(cron, "GET", "/cron/retention", { token })).status).toBe(401);

    await db.insert(feedback).values({ type: "Bug", message: "ancient", createdAt: new Date("2000-01-01T00:00:00Z") });
    const res = await call(cron, "GET", "/cron/retention", { headers: { authorization: "Bearer cron-secret-value" } });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ feedback_anonymized: 1, deletion_records_anonymized: 0 });
  });
});
