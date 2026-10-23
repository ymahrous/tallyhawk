import { z } from "zod";
import { getDb } from "@/server/db";
import { feedback } from "@/server/db/schema";
import { json, parseJson, route } from "@/server/http";

const Body = z.object({ type: z.string(), message: z.string() });

// Open to signed-out visitors too, so feedback isn't linked to a user.
export const POST = route(async (request) => {
  const { type, message } = await parseJson(request, Body);
  await getDb().insert(feedback).values({ type, message });
  return json({ status: "success" });
});
