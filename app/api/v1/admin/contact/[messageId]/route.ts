import { and, eq, isNull } from "drizzle-orm";
import { TriageUpdate } from "@/server/admin";
import { audit } from "@/server/audit";
import { getDb } from "@/server/db";
import { contactMessages } from "@/server/db/schema";
import { ApiError, getCurrentAdmin, json, noContent, parseJson, route, type Params } from "@/server/http";
import { serializeContactMessage } from "@/server/serializers";

/** Moves a contact message through triage and/or sets the internal note. */
export const PATCH = route<Params<"messageId">>(async (request, ctx) => {
  const admin = await getCurrentAdmin(request);
  const { messageId } = await ctx.params;
  const body = await parseJson(request, TriageUpdate);
  const db = getDb();

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(contactMessages)
      .set({
        ...(body.status ? { status: body.status } : {}),
        ...(body.admin_note !== undefined ? { adminNote: body.admin_note || null } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(contactMessages.id, messageId), isNull(contactMessages.anonymizedAt)))
      .returning();
    if (!row) throw new ApiError(404, "Message not found.");
    await audit(tx, request, admin, {
      action: "contact.update",
      targetType: "contact",
      targetId: row.id,
      targetLabel: `${row.email}: ${row.subject}`,
      details: { status: body.status, note_changed: body.admin_note !== undefined },
    });
    return row;
  });
  return json(serializeContactMessage(updated));
});

export const DELETE = route<Params<"messageId">>(async (request, ctx) => {
  const admin = await getCurrentAdmin(request);
  const { messageId } = await ctx.params;
  const db = getDb();
  await db.transaction(async (tx) => {
    const [row] = await tx.delete(contactMessages).where(and(eq(contactMessages.id, messageId), isNull(contactMessages.anonymizedAt))).returning();
    if (!row) throw new ApiError(404, "Message not found.");
    await audit(tx, request, admin, { action: "contact.delete", targetType: "contact", targetId: row.id, targetLabel: `${row.email}: ${row.subject}` });
  });
  return noContent();
});
