import type { Metadata } from "next";
import AdminShell from "@/components/admin/AdminShell";
import { privatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePageMetadata({
  title: "Admin",
  description: "Tallyhawk admin dashboard: analytics, customers, admins and support inboxes.",
});

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
