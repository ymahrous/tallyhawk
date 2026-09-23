import type { Metadata } from "next";
import JsonLd from "@/components/seo/JsonLd";
import { pageMetadata } from "@/lib/seo";
import { simplePageGraph } from "@/lib/structured-data";

const TITLE = "Log In";
const DESCRIPTION =
  "Log in to Tallyhawk to upload receipts and invoices, review AI-extracted data, sync expenses to QuickBooks Online and export tax summaries.";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: "/login" });

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={simplePageGraph({ path: "/login", name: TITLE, description: DESCRIPTION })} />
      {children}
    </>
  );
}
