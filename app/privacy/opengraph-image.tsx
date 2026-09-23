import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/og";

export const alt = "Tallyhawk Privacy Policy";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOgImage({
    eyebrow: "Privacy Policy",
    title: "How Tallyhawk protects your financial data.",
    description:
      "What we collect, why, which providers process it, how long we keep it, and your rights under GDPR, CCPA/CPRA and PIPEDA.",
    showProductCard: false,
  });
}
