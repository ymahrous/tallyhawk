import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/og";

export const alt = "Create a free Tallyhawk account";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOgImage({
    eyebrow: "Get started",
    title: "Put your receipts on autopilot.",
    description:
      "Create a free account in seconds — 10 documents a month, no credit card required.",
  });
}
