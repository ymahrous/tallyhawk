import { inPeriod, loadSpendRows, sumBy } from "@/server/analytics";
import { getDb } from "@/server/db";
import { getCurrentUser, intQuery, json, requirePro, route } from "@/server/http";

export const GET = route(async (request) => {
  const user = await getCurrentUser(request);
  const year = intQuery(new URL(request.url), "year", { required: true })!;
  requirePro(user, "Analytics require Pro plan");

  const rows = (await loadSpendRows(getDb(), user.id, user.baseCurrency)).filter((r) => inPeriod(r, year));
  const byMonth = sumBy(rows, (r) => r.date.toISOString().slice(0, 7)); // "YYYY-MM"
  return json([...byMonth].sort(([a], [b]) => a.localeCompare(b)).map(([month, spend]) => ({ month, spend })));
});
