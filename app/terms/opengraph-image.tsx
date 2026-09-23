import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/og";

export const alt = "Tallyhawk Terms of Service";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOgImage({
    eyebrow: "Terms of Service",
    title: "The terms for using Tallyhawk.",
    description:
      "Accounts, billing, acceptable use, data ownership and the AI accuracy disclaimer — in plain language.",
    showProductCard: false,
  });
}
