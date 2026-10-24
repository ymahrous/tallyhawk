import { z } from "zod";
import { emailAddress } from "@/server/auth";
import { getDb } from "@/server/db";
import { contactMessages } from "@/server/db/schema";
import { clientIp, getOptionalUser, json, parseJson, route } from "@/server/http";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { CONTACT_LIMITS } from "@/lib/support";

// Single-line fields never contain line breaks, so they can't smuggle headers if ever emailed.
const singleLine = (max: number, required: string) =>
  z.string().trim().min(1, required).max(max).regex(/^[^\r\n]*$/, "Must be a single line.");

const Body = z.object({
  name: singleLine(CONTACT_LIMITS.name, "Please enter your name."),
  email: emailAddress,
  subject: singleLine(CONTACT_LIMITS.subject, "Please add a subject."),
  message: z.string().trim().min(CONTACT_LIMITS.messageMin, `Please write at least ${CONTACT_LIMITS.messageMin} characters.`).max(CONTACT_LIMITS.message),
  /** Honeypot: hidden from people, filled in by bots. */
  website: z.string().max(500).optional(),
});

const RECEIVED = { status: "success", message: "Thanks! We'll get back to you by email." };

/** The public contact form. Messages land in the admin dashboard's inbox. */
export const POST = route(async (request) => {
  const body = await parseJson(request, Body);
  await rateLimit("contact-ip", clientIp(request), LIMITS.contactPerIp);
  // Bots get the same answer as people, so they don't learn to skip the field.
  if (body.website) return json(RECEIVED);

  const user = await getOptionalUser(request);
  await getDb().insert(contactMessages).values({
    name: body.name,
    email: body.email,
    subject: body.subject,
    message: body.message,
    userId: user?.id ?? null,
  });
  return json(RECEIVED, { status: 201 });
});
