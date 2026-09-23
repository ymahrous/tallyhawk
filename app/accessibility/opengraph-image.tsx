import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/og";

export const alt = "Tallyhawk Accessibility Statement";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOgImage({
    eyebrow: "Accessibility",
    title: "Tallyhawk is built for everyone.",
    description:
      "Our WCAG 2.1 AA conformance target, the measures we take, and the known limitations we're working on.",
    showProductCard: false,
  });
}
