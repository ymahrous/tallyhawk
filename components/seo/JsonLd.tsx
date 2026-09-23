import { serializeJsonLd, type JsonLdNode } from "@/lib/structured-data";

/**
 * Renders schema.org structured data. A native <script> (not next/script) is correct here: JSON-LD is
 * data for crawlers, not executable code, and must be present in the server-rendered HTML.
 */
export default function JsonLd({ data }: { data: JsonLdNode | JsonLdNode[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
