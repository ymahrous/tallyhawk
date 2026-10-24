import { and, eq, isNull } from "drizzle-orm";
import { TriageUpdate } from "@/server/admin";
import { audit } from "@/server/audit";
import { getDb } from "@/server/db";
import { feedback, users } from "@/server/db/schema";
import { ApiError, getCurrentAdmin, json, noContent, parseJson, route, type Params } from "@/server/http";
import { serializeFeedback } from "@/server/serializers";

/** Moves feedback through triage and/or sets the internal note. */
export const PATCH = route<Params<"feedbackId">>(async (request, ctx) => {
  const admin = await getCurrentAdmin(request);
  const { feedbackId } = await ctx.params;
  const body = await parseJson(request, TriageUpdate);
  const db = getDb();

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(feedback)
      .set({
        ...(body.status ? { status: body.status } : {}),
        ...(body.admin_note !== undefined ? { adminNote: body.admin_note || null } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(feedback.id, feedbackId), isNull(feedback.anonymizedAt)))
      .returning();
    if (!row) throw new ApiError(404, "Feedback not found.");
    await audit(tx, request, admin, {
      action: "feedback.update",
      targetType: "feedback",
      targetId: row.id,
      targetLabel: `${row.type}: ${(row.message ?? "").slice(0, 80)}`,
      details: { status: body.status, note_changed: body.admin_note !== undefined },
    });
    return row;
  });
  const [author] = updated.userId ? await db.select({ username: users.username }).from(users).where(eq(users.id, updated.userId)) : [];
  return json(serializeFeedback(updated, author?.username ?? null));
});

export const DELETE = route<Params<"feedbackId">>(async (request, ctx) => {
  const admin = await getCurrentAdmin(request);
  const { feedbackId } = await ctx.params;
  const db = getDb();
  await db.transaction(async (tx) => {
    const [row] = await tx.delete(feedback).where(and(eq(feedback.id, feedbackId), isNull(feedback.anonymizedAt))).returning();
    if (!row) throw new ApiError(404, "Feedback not found.");
    await audit(tx, request, admin, { action: "feedback.delete", targetType: "feedback", targetId: row.id, targetLabel: `${row.type}: ${(row.message ?? "").slice(0, 80)}` });
  });
  return noContent();
});
