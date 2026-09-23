import { describe, it, expect } from "vitest";
import { PRICING_FAQ, PRODUCT_FAQ, HOW_IT_WORKS } from "./marketing";
import { PRICING_PLANS } from "./pricing";
import {
  ORGANIZATION_ID,
  SOFTWARE_ID,
  WEBSITE_ID,
  breadcrumbSchema,
  faqPageSchema,
  howToSchema,
  jsonLdGraph,
  organizationSchema,
  serializeJsonLd,
  simplePageGraph,
  softwareApplicationSchema,
  webPageSchema,
} from "./structured-data";

describe("serializeJsonLd", () => {
  it("escapes < so a string can't close the script tag", () => {
    const out = serializeJsonLd({ name: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("</script>");
    expect(JSON.parse(out)).toEqual({ name: "</script><script>alert(1)</script>" });
  });
});

describe("entity graph", () => {
  it("links website and app back to the organization by @id", () => {
    const graph = jsonLdGraph(organizationSchema(), softwareApplicationSchema());
    expect(graph["@context"]).toBe("https://schema.org");
    const [org, app] = graph["@graph"] as Record<string, unknown>[];
    expect(org["@id"]).toBe(ORGANIZATION_ID);
    expect(app.publisher).toEqual({ "@id": ORGANIZATION_ID });
  });

  it("uses a raster logo with dimensions, as Google requires", () => {
    const org = organizationSchema();
    expect(org.logo).toMatchObject({
      url: "https://tallyhawk.vercel.app/logo.png",
      width: 512,
      height: 512,
    });
    expect(org.sameAs).toContain("https://github.com/ymahrous");
  });

  it("describes every pricing plan as a monthly USD offer", () => {
    const offers = softwareApplicationSchema().offers as Record<string, unknown>[];
    expect(offers).toHaveLength(PRICING_PLANS.length);
    PRICING_PLANS.forEach((plan, index) => {
      expect(offers[index]).toMatchObject({
        "@type": "Offer",
        price: plan.priceMonthly.toFixed(2),
        priceCurrency: "USD",
        priceSpecification: { billingDuration: "P1M", unitCode: "MON" },
      });
    });
  });

  it("never claims ratings or reviews", () => {
    const json = serializeJsonLd(softwareApplicationSchema());
    expect(json).not.toMatch(/aggregateRating|"review"/);
  });

  it("builds web pages that point at the site and the app", () => {
    const page = webPageSchema({
      path: "/pricing",
      name: "Pricing",
      description: "d",
      breadcrumb: [{ name: "Pricing", path: "/pricing" }],
    });
    expect(page).toMatchObject({
      "@id": "https://tallyhawk.vercel.app/pricing#webpage",
      isPartOf: { "@id": WEBSITE_ID },
      about: { "@id": SOFTWARE_ID },
      breadcrumb: { "@id": "https://tallyhawk.vercel.app/pricing#breadcrumb" },
    });
  });
});

describe("breadcrumbSchema", () => {
  it("starts at Home and numbers positions from 1", () => {
    const crumbs = breadcrumbSchema("/terms", [{ name: "Terms of Service", path: "/terms" }]);
    expect(crumbs.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Home", item: "https://tallyhawk.vercel.app/" },
      {
        "@type": "ListItem",
        position: 2,
        name: "Terms of Service",
        item: "https://tallyhawk.vercel.app/terms",
      },
    ]);
  });
});

describe("faqPageSchema", () => {
  it("mirrors the visible FAQ questions and answers exactly", () => {
    const schema = faqPageSchema("/", PRODUCT_FAQ);
    const entities = schema.mainEntity as { name: string; acceptedAnswer: { text: string } }[];
    expect(entities.map((q) => q.name)).toEqual(PRODUCT_FAQ.map((q) => q.question));
    expect(entities.map((q) => q.acceptedAnswer.text)).toEqual(PRODUCT_FAQ.map((q) => q.answer));
  });

  it("keeps home and pricing FAQs distinct (Google ignores duplicated FAQ markup)", () => {
    const home = new Set(PRODUCT_FAQ.map((q) => q.question));
    expect(PRICING_FAQ.some((q) => home.has(q.question))).toBe(false);
  });
});

describe("howToSchema", () => {
  it("has one ordered step per how-it-works item", () => {
    const steps = howToSchema(HOW_IT_WORKS).step as { position: number; name: string }[];
    expect(steps.map((s) => s.position)).toEqual([1, 2, 3]);
    expect(steps.map((s) => s.name)).toEqual(HOW_IT_WORKS.map((s) => s.title));
  });
});

describe("simplePageGraph", () => {
  it("pairs a web page with its breadcrumb", () => {
    const graph = simplePageGraph({ path: "/privacy", name: "Privacy Policy", description: "d" });
    const types = (graph["@graph"] as Record<string, unknown>[]).map((n) => n["@type"]);
    expect(types).toEqual(["WebPage", "BreadcrumbList"]);
  });
});
