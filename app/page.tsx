import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import JsonLd from "@/components/seo/JsonLd";
import FaqList from "@/components/marketing/FaqList";
import AtAGlance from "@/components/marketing/AtAGlance";
import CtaBanner from "@/components/marketing/CtaBanner";
import HowItWorks from "@/components/marketing/HowItWorks";
import FeatureGrid from "@/components/marketing/FeatureGrid";
import AuthAwareCta from "@/components/marketing/AuthAwareCta";
import SectionHeading from "@/components/marketing/SectionHeading";
import ProductPreview from "@/components/marketing/ProductPreview";
import { pageMetadata } from "@/lib/seo";
import { FEATURES, GLANCE_FACTS, HOW_IT_WORKS, PRODUCT_FAQ } from "@/lib/marketing";
import { PRODUCT_FACTS, SITE_DESCRIPTION, SITE_SUMMARY, SITE_TITLE } from "@/lib/site";
import { faqPageSchema, howToSchema, jsonLdGraph, softwareApplicationSchema, webPageSchema } from "@/lib/structured-data";

export const metadata: Metadata = pageMetadata({
  title: SITE_TITLE,
  absoluteTitle: true,
  description: SITE_DESCRIPTION,
  path: "/",
});

const structuredData = jsonLdGraph(
  webPageSchema({ path: "/", name: SITE_TITLE, description: SITE_DESCRIPTION }),
  softwareApplicationSchema(),
  howToSchema(HOW_IT_WORKS),
  faqPageSchema("/", PRODUCT_FAQ)
);

// Server Component: all copy ships in the initial HTML for crawlers and answer engines; only the
// auth-aware CTAs hydrate. Content constants live in lib/marketing.ts.
export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-gray-900 dark:bg-black dark:text-white">
      <JsonLd data={structuredData} />

      <section aria-labelledby="hero-heading" className="relative px-6 pt-36 pb-20 sm:pt-44">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-grid mask-[radial-gradient(ellipse_at_top,black_20%,transparent_70%)]" />
        <div aria-hidden="true" className="pointer-events-none absolute -top-48 left-1/2 h-128 w-4xl -translate-x-1/2 rounded-full bg-indigo-500/15 blur-3xl dark:bg-indigo-500/20" />

        <div className="relative mx-auto max-w-4xl text-center">
          <Link
            href="/#features"
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-4 py-1.5 text-sm text-gray-700 transition-colors hover:border-gray-300 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:border-white/20"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500 motion-safe:animate-pulse" aria-hidden="true" />
            QuickBooks Online sync is live
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>

          <h1 id="hero-heading" className="mt-8 text-4xl font-bold leading-[1.05] tracking-tight text-balance sm:text-6xl md:text-7xl">
            Turn receipts and invoices into{" "}
            <span className="bg-linear-to-r from-indigo-600 via-violet-500 to-emerald-500 bg-clip-text text-transparent dark:from-indigo-400 dark:via-violet-400 dark:to-emerald-400">
              <span className="whitespace-nowrap">tax-ready</span> books
            </span>
          </h1>

          <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-gray-600 sm:text-xl dark:text-gray-400">
            {SITE_SUMMARY}
          </p>

          <AuthAwareCta className="mt-10" primaryLabel="Start free" secondary={{ href: "/pricing", label: "See pricing" }} />

          <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
            {PRODUCT_FACTS.freeDocumentsPerMonth} documents free every month · No credit card required · {PRODUCT_FACTS.currencyCount} currencies
          </p>
        </div>
      </section>

      <section aria-label="Product preview" className="px-4 pb-24 sm:px-6 sm:pb-32">
        <ProductPreview />
      </section>

      <section aria-labelledby="glance-heading" className="mx-auto max-w-5xl scroll-mt-24 px-6 pb-24 sm:pb-32">
        <SectionHeading id="glance-heading" eyebrow="At a glance" title="Everything you need to know in thirty seconds." />
        <AtAGlance facts={GLANCE_FACTS} labelledBy="glance-heading" />
      </section>

      <section id="how-it-works" aria-labelledby="how-heading" className="mx-auto max-w-5xl scroll-mt-24 px-6 pb-24 sm:pb-32">
        <SectionHeading
          id="how-heading"
          eyebrow="How it works"
          title="From shoebox to QuickBooks in three steps."
          description="No templates to configure and no rules to write. Tallyhawk reads each document the way a bookkeeper would."
        />
        <HowItWorks steps={HOW_IT_WORKS} />
      </section>

      <section id="features" aria-labelledby="features-heading" className="mx-auto max-w-6xl scroll-mt-24 px-6 pb-24 sm:pb-32">
        <SectionHeading
          id="features-heading"
          eyebrow="Features"
          title="Built for solo founders who'd rather not do data entry."
          description="Every feature exists to get receipts out of your inbox and into your accounting software, accurately."
        />
        <FeatureGrid features={FEATURES} />
      </section>

      <section id="faq" aria-labelledby="faq-heading" className="mx-auto max-w-3xl scroll-mt-24 px-6 pb-24 sm:pb-32">
        <SectionHeading id="faq-heading" eyebrow="FAQ" title="Frequently asked questions" align="center" />
        <FaqList items={PRODUCT_FAQ} />
      </section>

      <CtaBanner />
    </div>
  );
}
