import type { Metadata } from "next";
import { privatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePageMetadata({
  title: "Dashboard",
  description: "Upload and manage your receipts and invoices.",
});

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
