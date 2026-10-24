import "server-only";
import { and, eq, inArray, isNotNull, isNull, lt, or } from "drizzle-orm";
import { RETENTION } from "@/lib/retention";
import type { Db } from "./db";
import { auditLog, contactMessages, deletedAccounts, feedback, passwordResetTokens, rateLimits, stripeEvents } from "./db/schema";

// Enforces the retention schedule in lib/retention.ts. Runs daily (GET /api/v1/cron/retention, see
// vercel.json). Personal data past its period is anonymized (set to NULL) and the remainder kept;
// data with no anonymized value is deleted. Every step is idempotent, so a missed or repeated run
// is harmless.

export interface RetentionResult {
  deletion_records_anonymized: number;
  contact_messages_anonymized: number;
  feedback_anonymized: number;
  audit_log_entries_anonymized: number;
  stripe_events_deleted: number;
  reset_links_deleted: number;
  rate_limit_counters_deleted: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const before = (now: Date, ms: number) => new Date(now.getTime() - ms);

/** What an anonymized audit entry loses: whom the action targeted, and where it came from. */
const ANONYMOUS_AUDIT = { targetLabel: null, targetId: null, ipHash: null };

export async function applyRetention(db: Db, now = new Date()): Promise<RetentionResult> {
  const count = async (rows: Promise<unknown[]>) => (await rows).length;

  // Deletion records lose the email, former id and Stripe ids, and so does every audit entry about
  // that account, so the email is gone everywhere at once.
  const deletionRecords = await db.transaction(async (tx) => {
    const due = await tx
      .select({ id: deletedAccounts.id, userId: deletedAccounts.userId })
      .from(deletedAccounts)
      .where(and(lt(deletedAccounts.deletedAt, before(now, RETENTION.deletionRecordIdentifiersDays * DAY_MS)), isNull(deletedAccounts.anonymizedAt)));
    if (!due.length) return 0;
    const formerIds = due.map((d) => d.userId).filter((id): id is string => Boolean(id));
    if (formerIds.length) {
      await tx
        .update(auditLog)
        .set({ ...ANONYMOUS_AUDIT, anonymizedAt: now })
        .where(and(eq(auditLog.targetType, "user"), inArray(auditLog.targetId, formerIds)));
    }
    await tx
      .update(deletedAccounts)
      .set({ username: null, userId: null, stripeCustomerId: null, stripeSubscriptionId: null, anonymizedAt: now })
      .where(inArray(deletedAccounts.id, due.map((d) => d.id)));
    return due.length;
  });

  // Support messages keep only their type/status and dates; anything still open is archived.
  const supportCutoff = before(now, RETENTION.supportMessageDays * DAY_MS);
  const contact = await count(
    db
      .update(contactMessages)
      .set({ name: null, email: null, subject: null, message: null, adminNote: null, userId: null, status: "archived", anonymizedAt: now })
      .where(and(lt(contactMessages.createdAt, supportCutoff), isNull(contactMessages.anonymizedAt)))
      .returning({ id: contactMessages.id })
  );
  const feedbackRows = await count(
    db
      .update(feedback)
      .set({ message: null, page: null, adminNote: null, userId: null, status: "archived", anonymizedAt: now })
      .where(and(lt(feedback.createdAt, supportCutoff), isNull(feedback.anonymizedAt)))
      .returning({ id: feedback.id })
  );

  const audit = await count(
    db
      .update(auditLog)
      .set({ ...ANONYMOUS_AUDIT, anonymizedAt: now })
      .where(and(lt(auditLog.createdAt, before(now, RETENTION.auditLogIdentifiersDays * DAY_MS)), isNull(auditLog.anonymizedAt)))
      .returning({ id: auditLog.id })
  );

  // Nothing personal or useful once expired: deleted outright.
  const events = await count(
    db.delete(stripeEvents).where(lt(stripeEvents.createdAt, before(now, RETENTION.stripeEventDays * DAY_MS))).returning({ id: stripeEvents.id })
  );
  const links = await count(
    db
      .delete(passwordResetTokens)
      .where(or(lt(passwordResetTokens.expiresAt, now), eq(passwordResetTokens.used, true)))
      .returning({ id: passwordResetTokens.id })
  );
  const counters = await count(
    db.delete(rateLimits).where(lt(rateLimits.windowStart, before(now, RETENTION.rateLimitHours * HOUR_MS))).returning({ id: rateLimits.key })
  );

  return {
    deletion_records_anonymized: deletionRecords,
    contact_messages_anonymized: contact,
    feedback_anonymized: feedbackRows,
    audit_log_entries_anonymized: audit,
    stripe_events_deleted: events,
    reset_links_deleted: links,
    rate_limit_counters_deleted: counters,
  };
}

/** A deletion record that had a subscription, whether or not its Stripe ids have been anonymized. */
export const hadSubscription = or(
  isNotNull(deletedAccounts.stripeSubscriptionId),
  isNotNull(deletedAccounts.stripeCustomerId),
  isNotNull(deletedAccounts.subscriptionStatusAtDeletion),
  isNotNull(deletedAccounts.subscriptionStatus)
);
