import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Forgot Password",
  description: "Reset your Tallyhawk password if you've forgotten it.",
  alternates: { canonical: "/forgot-password" },
  robots: { index: true, follow: true },
};

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}