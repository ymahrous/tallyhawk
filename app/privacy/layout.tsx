import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Learn how Tallyhawk collects, uses, and protects your data.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: "Tallyhawk Privacy Policy",
    description: "Learn how Tallyhawk collects, uses, and protects your data.",
  },
  robots: { index: true, follow: true },
};

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}