import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing",
  description: "View our pricing plans and choose the right one for you.",
  robots: { index: false, follow: false },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}