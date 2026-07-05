import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Vendors",
  description: "Upload and manage your vendor information.",
  robots: { index: false, follow: false },
};

export default function VendorsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}