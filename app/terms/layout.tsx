import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Read the Tallyhawk terms of service before using the platform.",
  alternates: { canonical: "/terms" },
  openGraph: {
    title: "Tallyhawk Terms of Service",
    description: "Read the Tallyhawk terms of service before using the platform.",
  },
  robots: { index: true, follow: true },
};

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}