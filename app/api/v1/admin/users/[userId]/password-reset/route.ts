import { sendPasswordReset } from "@/server/accounts";
import { findCustomer } from "@/server/admin";
import { audit } from "@/server/audit";
import { getDb } from "@/server/db";
import { getCurrentAdmin, json, route, type Params } from "@/server/http";

/** Emails the customer a password-reset link. Admins never see or set a customer's password. */
export const POST = route<Params<"userId">>(async (request, ctx) => {
  const admin = await getCurrentAdmin(request);
  const { userId } = await ctx.params;
  const db = getDb();
  const user = await findCustomer(db, userId);
  await sendPasswordReset(db, request, user);
  await audit(db, request, admin, { action: "user.password_reset", targetType: "user", targetId: user.id, targetLabel: user.username });
  return json({ message: `A password-reset link was sent to ${user.username}.` });
});
