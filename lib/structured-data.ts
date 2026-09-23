import { FEATURES, type FaqItem, type HowItWorksStep } from "@/lib/marketing";
import { PRICING_PLANS } from "@/lib/pricing";
import {
  SITE_LANGUAGE,
  SITE_NAME,
  SITE_SUMMARY,
  SITE_URL,
  SOCIAL_LINKS,
  absoluteUrl,
} from "@/lib/site";

// schema.org JSON-LD builders. Entities reference each other by stable `@id`s so search and
// answer engines can join the graph across pages (the page is about the app, which is published
// by the organization). Never add ratings or reviews here unless they come from real customers.

export type JsonLdNode = Record<string, unknown>;

export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;
export const SOFTWARE_ID = `${SITE_URL}/#software`;

/** JSON.stringify doesn't escape `<`, so a string containing `</script>` could break out of the tag. */
export function serializeJsonLd(data: JsonLdNode | JsonLdNode[]): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function jsonLdGraph(...nodes: JsonLdNode[]): JsonLdNode {
  return { "@context": "https://schema.org", "@graph": nodes };
}

export function organizationSchema(): JsonLdNode {
  return {
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: SITE_NAME,
    url: absoluteUrl("/"),
    logo: {
      "@type": "ImageObject",
      "@id": `${SITE_URL}/#logo`,
      url: absoluteUrl("/logo.png"),
      contentUrl: absoluteUrl("/logo.png"),
      width: 512,
      height: 512,
      caption: SITE_NAME,
    },
    image: { "@id": `${SITE_URL}/#logo` },
    description: SITE_SUMMARY,
    sameAs: [SOCIAL_LINKS.github],
  };
}

export function websiteSchema(): JsonLdNode {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    url: absoluteUrl("/"),
    name: SITE_NAME,
    description: SITE_SUMMARY,
    inLanguage: SITE_LANGUAGE,
    publisher: { "@id": ORGANIZATION_ID },
  };
}

export function softwareApplicationSchema(): JsonLdNode {
  return {
    "@type": "WebApplication",
    "@id": SOFTWARE_ID,
    name: SITE_NAME,
    url: absoluteUrl("/"),
    description: SITE_SUMMARY,
    applicationCategory: "FinanceApplication",
    applicationSubCategory: "Bookkeeping and expense management",
    operatingSystem: "Web browser (desktop and mobile)",
    browserRequirements: "Requires JavaScript and a modern web browser.",
    image: absoluteUrl("/logo.png"),
    inLanguage: SITE_LANGUAGE,
    isAccessibleForFree: true,
    featureList: FEATURES.map((feature) => feature.title),
    publisher: { "@id": ORGANIZATION_ID },
    offers: PRICING_PLANS.map((plan) => ({
      "@type": "Offer",
      name: `${SITE_NAME} ${plan.name}`,
      description: plan.description,
      url: absoluteUrl("/pricing"),
      price: plan.priceMonthly.toFixed(2),
      priceCurrency: plan.currency,
      availability: "https://schema.org/InStock",
      category: plan.priceMonthly === 0 ? "Free" : "Subscription",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: plan.priceMonthly.toFixed(2),
        priceCurrency: plan.currency,
        billingDuration: "P1M",
        unitCode: "MON",
        unitText: "month",
      },
    })),
  };
}

interface WebPageOptions {
  path: string;
  name: string;
  description: string;
  type?: "WebPage" | "AboutPage" | "FAQPage" | "CollectionPage";
  /** Breadcrumb trail below the home page, e.g. [{ name: "Pricing", path: "/pricing" }]. */
  breadcrumb?: { name: string; path: string }[];
}

export function webPageSchema({
  path,
  name,
  description,
  type = "WebPage",
  breadcrumb,
}: WebPageOptions): JsonLdNode {
  const url = absoluteUrl(path);
  return {
    "@type": type,
    "@id": `${url}#webpage`,
    url,
    name,
    description,
    inLanguage: SITE_LANGUAGE,
    isPartOf: { "@id": WEBSITE_ID },
    about: { "@id": SOFTWARE_ID },
    publisher: { "@id": ORGANIZATION_ID },
    ...(breadcrumb && { breadcrumb: { "@id": `${url}#breadcrumb` } }),
  };
}

export function breadcrumbSchema(
  path: string,
  trail: { name: string; path: string }[]
): JsonLdNode {
  const items = [{ name: "Home", path: "/" }, ...trail];
  return {
    "@type": "BreadcrumbList",
    "@id": `${absoluteUrl(path)}#breadcrumb`,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function faqPageSchema(path: string, items: readonly FaqItem[]): JsonLdNode {
  return {
    "@type": "FAQPage",
    "@id": `${absoluteUrl(path)}#faq`,
    isPartOf: { "@id": `${absoluteUrl(path)}#webpage` },
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

export function howToSchema(steps: readonly HowItWorksStep[]): JsonLdNode {
  return {
    "@type": "HowTo",
    "@id": `${absoluteUrl("/")}#how-it-works`,
    name: "How to turn receipts and invoices into QuickBooks expenses with Tallyhawk",
    description: SITE_SUMMARY,
    step: steps.map((step, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: step.title,
      text: step.description,
      url: `${absoluteUrl("/")}#how-it-works`,
    })),
  };
}

/** Standard graph for a simple content page (legal pages, auth pages): WebPage + breadcrumb. */
export function simplePageGraph(
  options: Required<Pick<WebPageOptions, "path" | "name" | "description">>
): JsonLdNode {
  const trail = [{ name: options.name, path: options.path }];
  return jsonLdGraph(
    webPageSchema({ ...options, breadcrumb: trail }),
    breadcrumbSchema(options.path, trail)
  );
}
