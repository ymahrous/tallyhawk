import { revokeSessions } from "@/server/accounts";
import { findCustomer } from "@/server/admin";
import { audit } from "@/server/audit";
import { getDb } from "@/server/db";
import { getCurrentAdmin, noContent, route, type Params } from "@/server/http";

/** Signs a customer out of every session (e.g. a lost laptop or a suspected compromise). */
export const POST = route<Params<"userId">>(async (request, ctx) => {
  const admin = await getCurrentAdmin(request);
  const { userId } = await ctx.params;
  const db = getDb();
  const user = await findCustomer(db, userId);
  await revokeSessions(db, user.id);
  await audit(db, request, admin, { action: "user.sign_out", targetType: "user", targetId: user.id, targetLabel: user.username });
  return noContent();
});
