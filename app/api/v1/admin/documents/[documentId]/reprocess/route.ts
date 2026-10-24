import { eq } from "drizzle-orm";
import { audit } from "@/server/audit";
import { runInBackground } from "@/server/background";
import { getDb } from "@/server/db";
import { documents, extractions, users } from "@/server/db/schema";
import { ApiError, getCurrentAdmin, json, route, type Params } from "@/server/http";
import { processDocument } from "@/server/pipeline";

// Extraction runs in the background after the response, as it does for uploads.
export const maxDuration = 60;

/** How long a document may sit in PENDING/PROCESSING before it counts as stuck. */
const STUCK_AFTER_MS = 10 * 60 * 1000;

/**
 * Runs extraction again for a FAILED document, or one stuck in PENDING/PROCESSING (the process died
 * mid-extraction). Doesn't count against the owner's monthly quota.
 */
export const POST = route<Params<"documentId">>(async (request, ctx) => {
  const admin = await getCurrentAdmin(request);
  const { documentId } = await ctx.params;
  const db = getDb();

  const [row] = await db
    .select({ doc: documents, username: users.username })
    .from(documents)
    .innerJoin(users, eq(users.id, documents.ownerId))
    .where(eq(documents.id, documentId))
    .limit(1);
  if (!row) throw new ApiError(404, "Document not found.");
  const { doc } = row;
  const stuck = (doc.status === "PENDING" || doc.status === "PROCESSING") && Date.now() - doc.createdAt.getTime() > STUCK_AFTER_MS;
  if (doc.status !== "FAILED" && !stuck) throw new ApiError(409, "Only failed or stuck documents can be reprocessed.");

  await db.transaction(async (tx) => {
    await tx.delete(extractions).where(eq(extractions.documentId, doc.id));
    await tx.update(documents).set({ status: "PENDING", flags: null }).where(eq(documents.id, doc.id));
    await audit(tx, request, admin, {
      action: "document.reprocess",
      targetType: "document",
      targetId: doc.id,
      targetLabel: `${row.username}: ${doc.filename}`,
      details: { previous_status: doc.status },
    });
  });
  runInBackground("reprocess_document", () => processDocument(doc.id));
  return json({ message: "Reprocessing started.", document_id: doc.id, status: "PENDING" });
});
