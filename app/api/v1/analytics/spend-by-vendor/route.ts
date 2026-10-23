import { inPeriod, loadSpendRows, sumBy } from "@/server/analytics";
import { getDb } from "@/server/db";
import { getCurrentUser, intQuery, json, requirePro, route } from "@/server/http";

export const GET = route(async (request) => {
  const user = await getCurrentUser(request);
  const url = new URL(request.url);
  const year = intQuery(url, "year", { required: true })!;
  const month = intQuery(url, "month");
  requirePro(user, "Analytics require Pro plan");

  const rows = (await loadSpendRows(getDb(), user.id, user.baseCurrency)).filter((r) => inPeriod(r, year, month));
  const top10 = [...sumBy(rows, (r) => r.vendorName ?? "Unknown")].sort((a, b) => b[1] - a[1]).slice(0, 10);
  return json(top10.map(([name, value]) => ({ name, value })));
});
