import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { documents, extractions } from "@/server/db/schema";
import { ApiError, getCurrentUser, noContent, route, type Params } from "@/server/http";
import { deleteFromStorage } from "@/server/storage";

export const DELETE = route<Params<"documentId">>(async (request, ctx) => {
  const user = await getCurrentUser(request);
  const { documentId } = await ctx.params;
  const db = getDb();

  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.ownerId, user.id)))
    .limit(1);
  if (!doc) throw new ApiError(404, "Document not found");

  await db.transaction(async (tx) => {
    await tx.delete(extractions).where(eq(extractions.documentId, documentId));
    await tx.delete(documents).where(eq(documents.id, documentId));
  });

  // Known limitation: no recovery if this fails after the rows are gone. Rows from before per-user
  // storage paths have none, and their key is the filename.
  await deleteFromStorage(doc.storagePath ?? doc.filename);
  return noContent();
});
