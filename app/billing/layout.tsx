import type { Metadata } from "next";
import { privatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePageMetadata({
  title: "Billing",
  description: "Stripe checkout status for your Tallyhawk subscription.",
});

export default function BillingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
