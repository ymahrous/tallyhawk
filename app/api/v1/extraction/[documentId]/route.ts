import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { documents, extractions, vendors } from "@/server/db/schema";
import { ApiError, getCurrentUser, json, route, type Params } from "@/server/http";
import { serializeExtraction } from "@/server/serializers";

export const GET = route<Params<"documentId">>(async (request, ctx) => {
  const user = await getCurrentUser(request);
  const { documentId } = await ctx.params;

  // Scoped to the caller's own documents (the Python version wasn't — see AGENTS.md).
  const [row] = await getDb()
    .select({ ext: extractions, vendor: vendors })
    .from(extractions)
    .innerJoin(documents, eq(documents.id, extractions.documentId))
    .leftJoin(vendors, eq(vendors.id, extractions.vendorId))
    .where(and(eq(extractions.documentId, documentId), eq(documents.ownerId, user.id)))
    .limit(1);

  if (!row) throw new ApiError(404, "Extraction not found or still processing.");
  return json(serializeExtraction(row.ext, row.vendor));
});
