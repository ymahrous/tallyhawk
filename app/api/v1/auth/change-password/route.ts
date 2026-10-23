import { eq } from "drizzle-orm";
import { z } from "zod";
import { hashPassword, newPassword, verifyPassword } from "@/server/auth";
import { getDb } from "@/server/db";
import { users } from "@/server/db/schema";
import { ApiError, getCurrentUser, json, parseJson, route } from "@/server/http";

const Body = z.object({ current_password: z.string(), new_password: newPassword });

export const POST = route(async (request) => {
  const user = await getCurrentUser(request);
  const body = await parseJson(request, Body);
  if (!(await verifyPassword(body.current_password, user.hashedPassword))) {
    throw new ApiError(400, "Current password is incorrect.");
  }
  await getDb()
    .update(users)
    .set({ hashedPassword: await hashPassword(body.new_password) })
    .where(eq(users.id, user.id));
  return json({ message: "Password updated successfully." });
});
