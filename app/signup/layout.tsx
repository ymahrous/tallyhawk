import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up",
  description: "Create a free Tallyhawk account and start extracting structured data from your documents.",
  alternates: { canonical: "/signup" },
  openGraph: {
    title: "Sign up for Tallyhawk",
    description: "Create a free Tallyhawk account and start extracting structured data from your documents.",
  },
  robots: { index: true, follow: true },
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}