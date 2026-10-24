import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { recordDeletion } from "@/server/accounts";
import { findAdmin } from "@/server/admin";
import { audit } from "@/server/audit";
import { getDb } from "@/server/db";
import { passwordResetTokens, users, type User } from "@/server/db/schema";
import { ApiError, getCurrentAdmin, json, noContent, parseJson, route, type Params } from "@/server/http";
import { serializeAccount } from "@/server/serializers";

/**
 * Admins can't suspend or delete themselves. Since only an active admin can make these changes,
 * that alone guarantees at least one active admin always remains.
 */
function guardChange(me: User, target: User, what: string) {
  if (target.id === me.id) throw new ApiError(400, `You can't ${what} your own admin account.`);
}

const Update = z.object({ status: z.enum(["active", "suspended"]) });

/** Suspends (signing them out everywhere) or reactivates another admin. */
export const PATCH = route<Params<"adminId">>(async (request, ctx) => {
  const me = await getCurrentAdmin(request);
  const { adminId } = await ctx.params;
  const { status } = await parseJson(request, Update);
  const db = getDb();
  const target = await findAdmin(db, adminId);
  if (status === target.status) return json({ ...serializeAccount(target), is_you: target.id === me.id });
  if (status === "suspended") guardChange(me, target, "suspend");

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(users)
      .set({ status, ...(status === "suspended" ? { tokenVersion: sql`${users.tokenVersion} + 1` } : {}) })
      .where(eq(users.id, target.id))
      .returning();
    await audit(tx, request, me, {
      action: status === "suspended" ? "admin.suspend" : "admin.reactivate",
      targetType: "admin",
      targetId: target.id,
      targetLabel: target.username,
    });
    return row;
  });
  return json({ ...serializeAccount(updated), is_you: false });
});

/** Removes another admin account, keeping a deletion record like a customer's. */
export const DELETE = route<Params<"adminId">>(async (request, ctx) => {
  const me = await getCurrentAdmin(request);
  const { adminId } = await ctx.params;
  const db = getDb();
  const target = await findAdmin(db, adminId);
  guardChange(me, target, "delete");

  await db.transaction(async (tx) => {
    await recordDeletion(tx, target, { by: "admin", admin: me });
    await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, target.id));
    await tx.delete(users).where(and(eq(users.id, target.id), eq(users.role, "admin")));
    await audit(tx, request, me, { action: "admin.delete", targetType: "admin", targetId: target.id, targetLabel: target.username });
  });
  return noContent();
});
