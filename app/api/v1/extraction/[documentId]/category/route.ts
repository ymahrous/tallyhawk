import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { documents, extractions } from "@/server/db/schema";
import { ApiError, getCurrentUser, json, requirePro, route, type Params } from "@/server/http";

const CATEGORIES = [
  "Travel",
  "Meals",
  "Software",
  "Office Supplies",
  "Equipment",
  "Marketing",
  "Utilities",
  "Rent",
  "Insurance",
  "Professional Services",
  "Other",
];

export const PATCH = route<Params<"documentId">>(async (request, ctx) => {
  const user = await getCurrentUser(request);
  requirePro(user, "Tax categorization is a Pro feature.");
  const { documentId } = await ctx.params;
  const body: unknown = await request.json().catch(() => ({}));
  const db = getDb();

  const [row] = await db
    .select({ id: extractions.id })
    .from(extractions)
    .innerJoin(documents, eq(documents.id, extractions.documentId))
    .where(and(eq(extractions.documentId, documentId), eq(documents.ownerId, user.id)))
    .limit(1);
  if (!row) throw new ApiError(404, "Extraction not found.");

  const category = body && typeof body === "object" ? (body as { category?: unknown }).category : undefined;
  if (typeof category !== "string" || !CATEGORIES.includes(category)) {
    throw new ApiError(400, `Invalid category. Must be one of: ${JSON.stringify(CATEGORIES)}`);
  }

  await db.update(extractions).set({ category }).where(eq(extractions.id, row.id));
  return json({ message: "Category updated", category });
});
