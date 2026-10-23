import { eq } from "drizzle-orm";
import { z } from "zod";
import { runInBackground } from "@/server/background";
import { VALID_CURRENCIES } from "@/server/currency";
import { getDb } from "@/server/db";
import { users } from "@/server/db/schema";
import { getCurrentUser, json, parseJson, route } from "@/server/http";
import { reconvertUserCurrency } from "@/server/pipeline";
import { serializeSettings } from "@/server/serializers";

// Reconverting every document can take a few exchange-rate lookups; give the background task room.
export const maxDuration = 60;

const Body = z.object({
  base_currency: z
    .string()
    .transform((v) => v.toUpperCase())
    .refine((v) => VALID_CURRENCIES.has(v), "Invalid currency code. Must be a valid ISO 4217 code.")
    .nullish(),
});

export const GET = route(async (request) => json(serializeSettings(await getCurrentUser(request))));

export const PATCH = route(async (request) => {
  let user = await getCurrentUser(request);
  const { base_currency } = await parseJson(request, Body);

  if (base_currency) {
    const changed = base_currency !== user.baseCurrency;
    [user] = await getDb().update(users).set({ baseCurrency: base_currency }).where(eq(users.id, user.id)).returning();

    // Changing the base currency re-converts existing documents (it isn't just a display setting),
    // so invoices, totals, analytics and tax exports never mix currencies. See AGENTS.md.
    if (changed) {
      const userId = user.id;
      runInBackground("reconvert_user_currency", () => reconvertUserCurrency(userId));
    }
  }

  return json(serializeSettings(user));
});
