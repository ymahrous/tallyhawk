import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/server/db";
import { extractions, vendors } from "@/server/db/schema";
import { ApiError, getCurrentUser, json, parseJson, route, type Params } from "@/server/http";
import { sameVendorName, serializeVendor } from "@/server/vendors";

const Body = z.object({ new_name: z.string().trim().min(1, "Vendor name can't be empty.") });

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

  // Canonical names are unique per user; without this check the update below would be a 500.
  const [clash] = await db
    .select({ id: vendors.id })
    .from(vendors)
    .where(and(eq(vendors.userId, user.id), eq(vendors.canonicalName, new_name), ne(vendors.id, vendor.id)))
    .limit(1);
  if (clash) throw new ApiError(400, "Another vendor already has that name. Merge the two vendors instead.");

  // The old name becomes an alias so future extractions under it still match this vendor. The new
  // name is the canonical one, so (as after a merge) it isn't also listed as an alias.
  const aliases = vendor.aliases ?? [];
  const known = aliases.some((a) => sameVendorName(a, vendor.canonicalName));
  const nextAliases = (known ? aliases : [...aliases, vendor.canonicalName]).filter((a) => !sameVendorName(a, new_name));

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
