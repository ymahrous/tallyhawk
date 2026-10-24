import type { Metadata } from "next";
import JsonLd from "@/components/seo/JsonLd";
import ContactForm from "@/components/contact/ContactForm";
import { pageMetadata } from "@/lib/seo";
import { CONTACT_PAGE } from "@/lib/marketing";
import { breadcrumbSchema, jsonLdGraph, webPageSchema } from "@/lib/structured-data";

const { title: TITLE, description: DESCRIPTION } = CONTACT_PAGE;

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: "/contact" });

const structuredData = jsonLdGraph(
  webPageSchema({ path: "/contact", name: `${TITLE} | Tallyhawk`, description: DESCRIPTION, type: "ContactPage", breadcrumb: [{ name: TITLE, path: "/contact" }] }),
  breadcrumbSchema("/contact", [{ name: TITLE, path: "/contact" }])
);

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 dark:bg-black dark:text-white">
      <JsonLd data={structuredData} />
      <section aria-labelledby="contact-heading" className="px-6 pt-32 pb-24">
        <div className="mx-auto max-w-xl">
          <h1 id="contact-heading" className="text-4xl font-bold tracking-tight md:text-5xl">
            {CONTACT_PAGE.heading}
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-gray-600 dark:text-gray-400">{CONTACT_PAGE.intro}</p>
          <div className="mt-10">
            <ContactForm />
          </div>
          <p className="mt-8 text-sm text-gray-500 dark:text-gray-400">{CONTACT_PAGE.feedbackHint}</p>
        </div>
      </section>
    </div>
  );
}
