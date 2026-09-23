import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/og";

export const alt = "Tallyhawk pricing — Free and Pro plans";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOgImage({
    eyebrow: "Pricing",
    title: "Start free. Upgrade for $5/month.",
    description:
      "10 free documents every month. Pro adds unlimited processing, QuickBooks sync, tax exports and analytics.",
  });
}
