import { deleteAccount } from "@/server/accounts";
import { getDb } from "@/server/db";
import { getCurrentUser, noContent, route } from "@/server/http";

// Customers delete themselves; admin accounts are removed by another admin (DELETE /admin/admins/{id}).
export const DELETE = route(async (request) => {
  const user = await getCurrentUser(request);
  await deleteAccount(getDb(), user, { by: "self" });
  return noContent();
});
