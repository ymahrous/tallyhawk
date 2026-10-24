import { timingSafeEqual } from "node:crypto";
import { getDb } from "@/server/db";
import { ApiError, json, route } from "@/server/http";
import { applyRetention } from "@/server/retention";

// Daily retention run (schedule in vercel.json). Vercel Cron sends `Authorization: Bearer
// $CRON_SECRET`; any other scheduler can call it the same way. Without CRON_SECRET it never runs.
export const maxDuration = 60;

function authorized(request: Request, secret: string): boolean {
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export const GET = route(async (request) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new ApiError(503, "Retention job not configured (CRON_SECRET is not set).");
  if (!authorized(request, secret)) throw new ApiError(401, "Not authenticated");

  const result = await applyRetention(getDb());
  console.info(JSON.stringify({ level: "info", event: "retention_applied", ...result }));
  return json(result);
});
