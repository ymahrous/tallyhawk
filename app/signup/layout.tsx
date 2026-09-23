import type { Metadata } from "next";
import JsonLd from "@/components/seo/JsonLd";
import { pageMetadata } from "@/lib/seo";
import { simplePageGraph } from "@/lib/structured-data";

const TITLE = "Sign Up";
const DESCRIPTION =
  "Create a free Tallyhawk account and start turning receipts and invoices into tax-ready data. 10 documents a month free, no credit card required.";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: "/signup" });

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={simplePageGraph({ path: "/signup", name: TITLE, description: DESCRIPTION })} />
      {children}
    </>
  );
}
