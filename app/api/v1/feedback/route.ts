import { z } from "zod";
import { getDb } from "@/server/db";
import { feedback } from "@/server/db/schema";
import { clientIp, getOptionalUser, json, parseJson, route } from "@/server/http";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { FEEDBACK_TYPES, MAX_FEEDBACK_LENGTH } from "@/lib/support";

const Body = z.object({
  type: z.enum(FEEDBACK_TYPES),
  message: z.string().trim().min(1, "Message is required.").max(MAX_FEEDBACK_LENGTH),
  /** The app path it was sent from, so a bug report says where the bug is. */
  page: z.string().max(300).regex(/^\/[^\s]*$/).nullish(),
});

// Open to signed-out visitors. When a customer is signed in, the feedback is linked to them so an
// admin can follow up on a bug report.
export const POST = route(async (request) => {
  const body = await parseJson(request, Body);
  await rateLimit("feedback-ip", clientIp(request), LIMITS.feedbackPerIp);
  const user = await getOptionalUser(request);
  await getDb()
    .insert(feedback)
    .values({ type: body.type, message: body.message, page: body.page ?? null, userId: user?.id ?? null });
  return json({ status: "success" });
});
