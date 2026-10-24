import "server-only";
import { asc, eq, inArray, sql, sum } from "drizzle-orm";
import { checkCredentials, createSessionToken, generatePasswordResetToken, hashResetToken } from "./auth";
import { cancelBillableSubscription, subscriptionOf } from "./billing";
import type { Db, Executor } from "./db";
import {
  contactMessages,
  deletedAccounts,
  documents,
  extractions,
  feedback,
  passwordResetTokens,
  quickbooksConnections,
  subscriptions,
  usageRecords,
  users,
  vendors,
  type User,
} from "./db/schema";
import { sendPasswordResetEmail } from "./email";
import { ApiError, appUrl, clientIp } from "./http";
import { LIMITS, rateLimit } from "./rate-limit";
import { deleteFromStorage } from "./storage";

/** Case-insensitive lookup: new accounts are stored lowercase, older ones may not be. */
export async function findAccountByUsername(db: Db, username: string): Promise<User | undefined> {
  const [account] = await db
    .select()
    .from(users)
    .where(eq(sql`lower(${users.username})`, username.trim().toLowerCase()))
    .orderBy(asc(users.createdAt))
    .limit(1);
  return account;
}

/**
 * Verifies a login attempt and returns the account. Rate limited per IP and per attempted username
 * (existing or not), with one generic error for every failure; a suspended account is only revealed
 * to someone who knows its password.
 */
export async function authenticate(db: Db, request: Request, username: string, password: string): Promise<User> {
  await rateLimit("login-ip", clientIp(request), LIMITS.loginPerIp);
  await rateLimit("login-account", username.trim(), LIMITS.loginPerAccount);

  const account = await findAccountByUsername(db, username);
  if (!(await checkCredentials(account, password)) || !account) throw new ApiError(401, "Invalid credentials");
  if (account.status !== "active") throw new ApiError(403, "This account has been suspended. Please contact support.");

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, account.id));
  return account;
}

export interface SessionResponse {
  access_token: string;
  token_type: "bearer";
  role: User["role"];
}

/** The body every endpoint that signs someone in (or refreshes a session) answers with. */
export async function issueSession(account: User): Promise<SessionResponse> {
  return { access_token: await createSessionToken(account), token_type: "bearer", role: account.role };
}

/** Invalidates every session the account holds (each token carries the version it was issued at). */
export async function revokeSessions(db: Db, accountId: string): Promise<User> {
  const [account] = await db
    .update(users)
    .set({ tokenVersion: sql`${users.tokenVersion} + 1` })
    .where(eq(users.id, accountId))
    .returning();
  return account;
}

/**
 * Emails a one-hour password-reset link. Only the token's hash is stored, and any earlier link for
 * the account stops working. Email failures are logged, never surfaced, so callers can't learn
 * whether an address has an account.
 */
export async function sendPasswordReset(db: Db, request: Request, account: Pick<User, "id" | "username">): Promise<void> {
  const token = generatePasswordResetToken();
  await db.transaction(async (tx) => {
    await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, account.id));
    await tx.insert(passwordResetTokens).values({ userId: account.id, token: hashResetToken(token) });
  });

  const resetUrl = `${appUrl(request)}/reset-password?token=${token}`;
  try {
    await sendPasswordResetEmail(account.username, resetUrl);
  } catch (error) {
    console.error(JSON.stringify({ level: "error", event: "reset_email_failed", error: String(error) }));
  }
  if (process.env.NODE_ENV !== "production") console.info(`Password reset link for ${account.username}: ${resetUrl}`);
}

/** Who deleted an account: the person themselves, or an admin. */
export type DeletedBy = { by: "self" } | { by: "admin"; admin: Pick<User, "id" | "username"> };

interface BillingAtDeletion {
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  subscriptionStatusAtDeletion?: string | null;
  subscriptionStatus?: string | null;
  currentPeriodEnd?: Date | null;
  billingCancelledAt?: Date | null;
}

/**
 * Writes the record that outlives a deleted account (see `deletedaccount` in the schema). Call it in
 * the same transaction that deletes the account, so there is never a deletion without a record.
 */
export async function recordDeletion(
  tx: Executor,
  account: Pick<User, "id" | "username" | "role" | "plan" | "createdAt">,
  deletedBy: DeletedBy,
  details: BillingAtDeletion & { lifetimeDocuments?: number } = {}
): Promise<void> {
  await tx.insert(deletedAccounts).values({
    userId: account.id,
    username: account.username,
    role: account.role,
    plan: account.role === "user" ? account.plan : null,
    accountCreatedAt: account.createdAt,
    deletedBy: deletedBy.by,
    deletedByAdminId: deletedBy.by === "admin" ? deletedBy.admin.id : null,
    deletedByAdminUsername: deletedBy.by === "admin" ? deletedBy.admin.username : null,
    ...details,
  });
}

/**
 * Permanently deletes a customer account and everything it owns, keeping only its deletion record.
 * Order matters: the Stripe subscription is cancelled first (so a deleted customer is never billed
 * again), then the files (if storage fails, nothing has been removed yet), then every row and the
 * deletion record in one transaction.
 */
export async function deleteAccount(db: Db, account: User, deletedBy: DeletedBy): Promise<void> {
  const subscription = await subscriptionOf(db, account.id);
  const cancellation = await cancelBillableSubscription(subscription);

  const docs = await db
    .select({ id: documents.id, filename: documents.filename, storagePath: documents.storagePath })
    .from(documents)
    .where(eq(documents.ownerId, account.id));
  for (const doc of docs) await deleteFromStorage(doc.storagePath ?? doc.filename);

  const [usage] = await db.select({ total: sum(usageRecords.documentsProcessed) }).from(usageRecords).where(eq(usageRecords.userId, account.id));
  const stopped = cancellation !== "not_billable";

  await db.transaction(async (tx) => {
    await recordDeletion(tx, account, deletedBy, {
      lifetimeDocuments: Number(usage?.total ?? 0),
      stripeCustomerId: subscription?.stripeCustomerId ?? null,
      stripeSubscriptionId: subscription?.stripeSubscriptionId ?? null,
      subscriptionStatusAtDeletion: subscription?.status ?? null,
      subscriptionStatus: stopped ? "canceled" : (subscription?.status ?? null),
      currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
      billingCancelledAt: cancellation === "cancelled" ? new Date() : null,
    });
    const ids = docs.map((d) => d.id);
    if (ids.length) await tx.delete(extractions).where(inArray(extractions.documentId, ids));
    await tx.delete(documents).where(eq(documents.ownerId, account.id));
    await tx.delete(vendors).where(eq(vendors.userId, account.id));
    await tx.delete(usageRecords).where(eq(usageRecords.userId, account.id));
    await tx.delete(subscriptions).where(eq(subscriptions.userId, account.id));
    await tx.delete(feedback).where(eq(feedback.userId, account.id));
    await tx.delete(contactMessages).where(eq(contactMessages.userId, account.id));
    await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, account.id));
    await tx.delete(quickbooksConnections).where(eq(quickbooksConnections.userId, account.id));
    await tx.delete(users).where(eq(users.id, account.id));
  });
}
