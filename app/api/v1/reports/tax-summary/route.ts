import { getDb } from "@/server/db";
import { getCurrentUser, intQuery, requirePro, route } from "@/server/http";
import { buildTaxSummaryCsv } from "@/server/tax-summary";

export const GET = route(async (request) => {
  const user = await getCurrentUser(request);
  const year = intQuery(new URL(request.url), "year", { required: true })!;
  requirePro(user, "Tax export is a Pro feature.");

  const csv = await buildTaxSummaryCsv(getDb(), user, year);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=Tallyhawk_Tax_Summary_${year}.csv`,
    },
  });
});
