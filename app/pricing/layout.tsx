import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Simple, transparent pricing for Tallyhawk. Start free with 10 documents a month, or upgrade to Pro for unlimited processing, QuickBooks sync, analytics, and tax exports.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Tallyhawk Pricing",
    description: "Simple, transparent pricing for Tallyhawk. Start free with 10 documents a month, or upgrade to Pro for unlimited processing, QuickBooks sync, analytics, and tax exports.",
  },
  robots: { index: true, follow: true },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}