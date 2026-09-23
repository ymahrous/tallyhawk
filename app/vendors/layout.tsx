import type { Metadata } from "next";
import { privatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePageMetadata({
  title: "Vendors",
  description: "Rename and merge the vendors Tallyhawk detected in your documents.",
});

export default function VendorsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
