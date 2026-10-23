import "server-only";
import { and, eq } from "drizzle-orm";
import type { Db } from "./db";
import { vendors, type VendorRow } from "./db/schema";
import { getCloseMatches } from "./difflib";

/**
 * Matches a raw extracted vendor string to one of the user's vendors (canonical name or alias,
 * case-insensitive, ≥ 80% difflib similarity), or creates a new vendor. A fuzzy hit that isn't an
 * exact known name is remembered as a new alias so the next match is exact.
 */
export async function matchOrCreateVendor(db: Db, userId: string, rawName: string | null | undefined): Promise<VendorRow | null> {
  const name = rawName?.trim();
  if (!name) return null;

  const existing = await db.select().from(vendors).where(eq(vendors.userId, userId));

  const allNames: string[] = [];
  const byName = new Map<string, VendorRow>();
  for (const v of existing) {
    for (const n of [v.canonicalName, ...(v.aliases ?? [])]) {
      allNames.push(n.toLowerCase());
      byName.set(n.toLowerCase(), v);
    }
  }

  const [match] = getCloseMatches(name.toLowerCase(), allNames, 1, 0.8);
  if (match) {
    const vendor = byName.get(match)!;
    const aliases = vendor.aliases ?? [];
    const known = aliases.some((a) => a.toLowerCase() === name.toLowerCase()) || vendor.canonicalName.toLowerCase() === name.toLowerCase();
    if (known) return vendor;
    const [updated] = await db
      .update(vendors)
      .set({ aliases: [...aliases, name] })
      .where(eq(vendors.id, vendor.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(vendors)
    .values({ userId, canonicalName: name, aliases: [] })
    .onConflictDoNothing({ target: [vendors.userId, vendors.canonicalName] })
    .returning();
  if (created) return created;
  // Two uploads from the same vendor finished at once and the other one created it first.
  const [raced] = await db.select().from(vendors).where(and(eq(vendors.userId, userId), eq(vendors.canonicalName, name)));
  return raced ?? null;
}

/** Vendor names and aliases are matched case-insensitively everywhere (see matchOrCreateVendor). */
export function sameVendorName(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

export function serializeVendor(v: VendorRow) {
  return {
    id: v.id,
    user_id: v.userId,
    canonical_name: v.canonicalName,
    aliases: v.aliases ?? [],
    created_at: v.createdAt.toISOString(),
  };
}
