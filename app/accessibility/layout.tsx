import type { Metadata } from "next";
import JsonLd from "@/components/seo/JsonLd";
import { pageMetadata } from "@/lib/seo";
import { simplePageGraph } from "@/lib/structured-data";

const TITLE = "Accessibility Statement";
const DESCRIPTION =
  "Tallyhawk's accessibility statement: our WCAG 2.1 AA conformance target, the measures we take, known limitations and how to report a barrier.";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: "/accessibility" });

export default function AccessibilityLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={simplePageGraph({ path: "/accessibility", name: TITLE, description: DESCRIPTION })} />
      {children}
    </>
  );
}
