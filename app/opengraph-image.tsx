import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/og";

export const alt = "Tallyhawk — AI receipt and invoice processing with QuickBooks sync";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOgImage({
    eyebrow: "AI bookkeeping for freelancers",
    title: "Receipts in. Tax-ready books out.",
    description: "Upload receipts and invoices — AI extracts, categorizes and syncs them to QuickBooks Online.",
  });
}
