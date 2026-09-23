import type { Metadata } from "next";
import JsonLd from "@/components/seo/JsonLd";
import { pageMetadata } from "@/lib/seo";
import { simplePageGraph } from "@/lib/structured-data";

const TITLE = "Privacy Policy";
const DESCRIPTION =
  "How Tallyhawk collects, stores and protects your documents and account data, which providers process it, and your rights under GDPR, CCPA and PIPEDA.";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: "/privacy" });

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={simplePageGraph({ path: "/privacy", name: TITLE, description: DESCRIPTION })} />
      {children}
    </>
  );
}
