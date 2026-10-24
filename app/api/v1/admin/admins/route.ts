import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { audit } from "@/server/audit";
import { emailAddress, hashPassword, newPassword } from "@/server/auth";
import { getDb } from "@/server/db";
import { users } from "@/server/db/schema";
import { ApiError, getCurrentAdmin, json, parseJson, route } from "@/server/http";
import { serializeAccount } from "@/server/serializers";

/** Every admin account, oldest first, with `is_you` marking the caller. */
export const GET = route(async (request) => {
  const me = await getCurrentAdmin(request);
  const admins = await getDb().select().from(users).where(eq(users.role, "admin")).orderBy(asc(users.createdAt));
  return json(admins.map((a) => ({ ...serializeAccount(a), is_you: a.id === me.id })));
});

const Create = z.object({ username: emailAddress, password: newPassword });

/**
 * Creates another admin account. Admins are a separate account type: a new email and password,
 * never a promoted customer (whose documents and billing would then belong to staff).
 */
export const POST = route(async (request) => {
  const me = await getCurrentAdmin(request);
  const { username, password } = await parseJson(request, Create);
  const db = getDb();

  const [taken] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.username}) = ${username}`).limit(1);
  if (taken) throw new ApiError(400, "An account with this email already exists.");

  const created = await db.transaction(async (tx) => {
    const [admin] = await tx
      .insert(users)
      .values({ username, hashedPassword: await hashPassword(password), role: "admin", plan: "free" })
      .returning();
    await audit(tx, request, me, { action: "admin.create", targetType: "admin", targetId: admin.id, targetLabel: admin.username });
    return admin;
  });
  return json({ ...serializeAccount(created), is_you: false }, { status: 201 });
});
