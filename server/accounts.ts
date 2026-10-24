import "server-only";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { checkCredentials, createSessionToken, generatePasswordResetToken, hashResetToken } from "./auth";
import { cancelBillableSubscription } from "./billing";
import type { Db } from "./db";
import {
  contactMessages,
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

/**
 * Permanently deletes an account and everything it owns. Order matters: the Stripe subscription is
 * cancelled first (so a deleted customer is never billed again), then the files (if storage fails,
 * nothing has been removed yet), then every row in one transaction.
 */
export async function deleteAccount(db: Db, account: Pick<User, "id">): Promise<void> {
  await cancelBillableSubscription(db, account.id);

  const docs = await db
    .select({ id: documents.id, filename: documents.filename, storagePath: documents.storagePath })
    .from(documents)
    .where(eq(documents.ownerId, account.id));
  for (const doc of docs) await deleteFromStorage(doc.storagePath ?? doc.filename);

  await db.transaction(async (tx) => {
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
