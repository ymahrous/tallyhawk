import type { Metadata } from "next";
import JsonLd from "@/components/seo/JsonLd";
import { pageMetadata } from "@/lib/seo";
import { simplePageGraph } from "@/lib/structured-data";

const TITLE = "Terms of Service";
const DESCRIPTION =
  "The terms that govern your use of Tallyhawk: accounts, Free and Pro billing, acceptable use, ownership of your documents and the AI accuracy disclaimer.";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: "/terms" });

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={simplePageGraph({ path: "/terms", name: TITLE, description: DESCRIPTION })} />
      {children}
    </>
  );
}
