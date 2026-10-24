import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/og";

export const alt = "Contact Tallyhawk";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOgImage({
    eyebrow: "Contact",
    title: "Talk to the Tallyhawk team.",
    description: "Billing, account, privacy and data requests, partnerships: send a message and we'll reply by email.",
  });
}
