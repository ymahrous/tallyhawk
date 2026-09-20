import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Accessibility",
  description: "Tallyhawk's accessibility commitment and WCAG 2.1 AA conformance status.",
  alternates: { canonical: "/accessibility" },
  openGraph: {
    title: "Tallyhawk Accessibility Statement",
    description: "Tallyhawk's accessibility commitment and WCAG 2.1 AA conformance status.",
  },
  robots: { index: true, follow: true },
};

export default function AccessibilityLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
