import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/server/db";
import { extractions, vendors } from "@/server/db/schema";
import { ApiError, getCurrentUser, json, parseJson, route, type Params } from "@/server/http";
import { sameVendorName, serializeVendor } from "@/server/vendors";

const Body = z.object({ target_vendor_id: z.string() });

export const POST = route<Params<"vendorId">>(async (request, ctx) => {
  const user = await getCurrentUser(request);
  const { vendorId: sourceId } = await ctx.params;
  const { target_vendor_id: targetId } = await parseJson(request, Body);
  const db = getDb();

  const [source] = await db.select().from(vendors).where(eq(vendors.id, sourceId)).limit(1);
  const [target] = await db.select().from(vendors).where(eq(vendors.id, targetId)).limit(1);
  if (!source || !target || source.userId !== user.id || target.userId !== user.id || source.id === target.id) {
    throw new ApiError(404, "Vendor(s) not found");
  }

  // The target absorbs the source's aliases and canonical name (case-insensitively de-duplicated,
  // the way vendor matching compares names).
  const aliases = [...(target.aliases ?? [])];
  for (const alias of [...(source.aliases ?? []), source.canonicalName]) {
    if (!sameVendorName(alias, target.canonicalName) && !aliases.some((a) => sameVendorName(a, alias))) aliases.push(alias);
  }

  const surviving = await db.transaction(async (tx) => {
    const [row] = await tx.update(vendors).set({ aliases }).where(eq(vendors.id, target.id)).returning();
    const linked = await tx.select().from(extractions).where(eq(extractions.vendorId, source.id));
    for (const ext of linked) {
      await tx
        .update(extractions)
        .set({ vendorId: target.id, extractedData: { ...(ext.extractedData ?? {}), vendor: target.canonicalName } })
        .where(eq(extractions.id, ext.id));
    }
    await tx.delete(vendors).where(eq(vendors.id, source.id));
    return row;
  });

  return json({ message: "Vendors merged successfully", surviving_vendor: serializeVendor(surviving) });
});
