import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/server/db";
import { extractions, vendors } from "@/server/db/schema";
import { ApiError, getCurrentUser, json, parseJson, route, type Params } from "@/server/http";
import { serializeVendor } from "@/server/vendors";

const Body = z.object({ new_name: z.string() });

export const PATCH = route<Params<"vendorId">>(async (request, ctx) => {
  const user = await getCurrentUser(request);
  const { vendorId } = await ctx.params;
  const { new_name } = await parseJson(request, Body);
  const db = getDb();

  const [vendor] = await db
    .select()
    .from(vendors)
    .where(and(eq(vendors.id, vendorId), eq(vendors.userId, user.id)))
    .limit(1);
  if (!vendor) throw new ApiError(404, "Vendor not found");

  // The old name becomes an alias so future extractions under it still match this vendor.
  const aliases = vendor.aliases ?? [];
  const nextAliases = aliases.includes(vendor.canonicalName) ? aliases : [...aliases, vendor.canonicalName];

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(vendors)
      .set({ canonicalName: new_name, aliases: nextAliases })
      .where(eq(vendors.id, vendor.id))
      .returning();
    const linked = await tx.select().from(extractions).where(eq(extractions.vendorId, vendor.id));
    for (const ext of linked) {
      await tx
        .update(extractions)
        .set({ extractedData: { ...(ext.extractedData ?? {}), vendor: new_name } })
        .where(eq(extractions.id, ext.id));
    }
    return row;
  });

  return json(serializeVendor(updated));
});
