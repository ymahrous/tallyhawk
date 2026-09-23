import type { Metadata } from "next";
import { privatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePageMetadata({
  title: "Account",
  description: "Manage your Tallyhawk account, plan, base currency and integrations.",
});

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
