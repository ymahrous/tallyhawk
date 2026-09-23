import type { Metadata } from "next";
import { Check, X } from "lucide-react";
import JsonLd from "@/components/seo/JsonLd";
import FaqList from "@/components/marketing/FaqList";
import PricingPlans from "@/components/pricing/PricingPlans";
import SectionHeading from "@/components/marketing/SectionHeading";
import { pageMetadata } from "@/lib/seo";
import { PRICING_FAQ } from "@/lib/marketing";
import { PLAN_COMPARISON, type ComparisonRow } from "@/lib/pricing";
import { breadcrumbSchema, faqPageSchema, jsonLdGraph, softwareApplicationSchema, webPageSchema } from "@/lib/structured-data";

const TITLE = "Pricing";
const DESCRIPTION =
  "Tallyhawk pricing: start free with 10 documents a month, or upgrade to Pro for $5/month for unlimited documents, QuickBooks Online sync, tax exports and spend analytics.";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: "/pricing" });

const structuredData = jsonLdGraph(
  webPageSchema({ path: "/pricing", name: `${TITLE} | Tallyhawk`, description: DESCRIPTION, breadcrumb: [{ name: TITLE, path: "/pricing" }] }),
  breadcrumbSchema("/pricing", [{ name: TITLE, path: "/pricing" }]),
  softwareApplicationSchema(),
  faqPageSchema("/pricing", PRICING_FAQ)
);

function Cell({ value }: { value: ComparisonRow["free"] }) {
  if (typeof value === "string") return <span className="whitespace-nowrap font-medium text-gray-900 dark:text-white">{value}</span>;
  return value ? (
    <>
      <Check className="mx-auto h-4 w-4 text-emerald-500" aria-hidden="true" />
      <span className="sr-only">Included</span>
    </>
  ) : (
    <>
      <X className="mx-auto h-4 w-4 text-gray-400 dark:text-gray-500" aria-hidden="true" />
      <span className="sr-only">Not included</span>
    </>
  );
}

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 dark:bg-black dark:text-white">
      <JsonLd data={structuredData} />

      <section aria-labelledby="pricing-heading" className="relative px-6 pt-32 pb-24">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_at_top,black_15%,transparent_65%)]" />
        <div className="relative mx-auto max-w-4xl text-center">
          <h1 id="pricing-heading" className="mb-6 text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl">
            Simple pricing,
            <br />
            <span className="text-gray-500">serious power.</span>
          </h1>
          <p className="mx-auto mb-16 max-w-xl text-lg leading-relaxed text-gray-600 dark:text-gray-400">
            Start free with 10 documents a month. Upgrade to Pro for $5/month when you need QuickBooks sync, tax exports and
            unlimited processing.
          </p>
          <PricingPlans />
          <p className="mt-8 text-sm text-gray-500 dark:text-gray-400">Prices in USD. Cancel anytime — Pro stays active until the end of your billing period.</p>
        </div>
      </section>

      <section aria-labelledby="compare-heading" className="mx-auto max-w-3xl px-6 pb-24">
        <SectionHeading id="compare-heading" eyebrow="Compare plans" title="Free vs. Pro, feature by feature" align="center" />
        <div className="overflow-hidden rounded-3xl border border-gray-200 dark:border-white/10">
          <table className="w-full text-sm">
            <caption className="sr-only">Tallyhawk Free and Pro plan comparison</caption>
            <thead className="bg-gray-50 dark:bg-white/5">
              <tr>
                <th scope="col" className="px-6 py-4 text-left font-semibold">Feature</th>
                <th scope="col" className="w-28 px-6 py-4 text-center font-semibold">Free</th>
                <th scope="col" className="w-28 px-6 py-4 text-center font-semibold">Pro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-white/10">
              {PLAN_COMPARISON.map((row) => (
                <tr key={row.feature}>
                  <th scope="row" className="px-6 py-4 text-left font-normal text-gray-700 dark:text-gray-300">{row.feature}</th>
                  <td className="px-6 py-4 text-center"><Cell value={row.free} /></td>
                  <td className="px-6 py-4 text-center"><Cell value={row.pro} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="faq" aria-labelledby="pricing-faq-heading" className="mx-auto max-w-3xl scroll-mt-24 px-6 pb-32">
        <SectionHeading id="pricing-faq-heading" eyebrow="Billing FAQ" title="Questions about plans and billing" align="center" />
        <FaqList items={PRICING_FAQ} />
      </section>
    </div>
  );
}
