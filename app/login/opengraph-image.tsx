import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/og";

export const alt = "Log in to Tallyhawk";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOgImage({
    eyebrow: "Welcome back",
    title: "Log in to Tallyhawk.",
    description: "Pick up where you left off: your documents, vendors and spend analytics.",
  });
}
