import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/server/db";
import {
  documents,
  extractions,
  feedback,
  passwordResetTokens,
  quickbooksConnections,
  subscriptions,
  usageRecords,
  users,
  vendors,
} from "@/server/db/schema";
import { getCurrentUser, noContent, route } from "@/server/http";
import { deleteFromStorage } from "@/server/storage";

export const DELETE = route(async (request) => {
  const user = await getCurrentUser(request);
  const db = getDb();

  const docs = await db.select({ id: documents.id, filename: documents.filename }).from(documents).where(eq(documents.ownerId, user.id));

  // Files first: if storage fails, nothing in the database has been removed yet.
  for (const doc of docs) await deleteFromStorage(doc.filename);

  await db.transaction(async (tx) => {
    const ids = docs.map((d) => d.id);
    if (ids.length) await tx.delete(extractions).where(inArray(extractions.documentId, ids));
    await tx.delete(documents).where(eq(documents.ownerId, user.id));
    await tx.delete(vendors).where(eq(vendors.userId, user.id));
    await tx.delete(usageRecords).where(eq(usageRecords.userId, user.id));
    await tx.delete(subscriptions).where(eq(subscriptions.userId, user.id));
    await tx.delete(feedback).where(eq(feedback.userId, user.id));
    await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));
    await tx.delete(quickbooksConnections).where(eq(quickbooksConnections.userId, user.id));
    await tx.delete(users).where(eq(users.id, user.id));
  });

  return noContent();
});
