import { describe, it, expect } from "vitest";
import { PRICING_PLANS, PLAN_COMPARISON, formatPlanPrice } from "./pricing";
import { FEATURES, GLANCE_FACTS, PRICING_FAQ, PRODUCT_FAQ } from "./marketing";
import {
  PRIVATE_ROUTE_PREFIXES,
  PRODUCT_FACTS,
  PUBLIC_ROUTES,
  SITE_DESCRIPTION,
  SITE_TITLE,
  absoluteUrl,
} from "./site";
import { SUPPORTED_CURRENCIES } from "./currency";
import { MAX_UPLOAD_MB } from "./uploads";

describe("absoluteUrl", () => {
  it("resolves paths against the canonical origin", () => {
    expect(absoluteUrl("/pricing")).toBe("https://tallyhawk.vercel.app/pricing");
    expect(absoluteUrl()).toBe("https://tallyhawk.vercel.app/");
  });
});

describe("search snippet lengths", () => {
  it("keeps the home title and description within what search results display", () => {
    expect(SITE_TITLE.length).toBeLessThanOrEqual(60);
    expect(SITE_DESCRIPTION.length).toBeGreaterThanOrEqual(120);
    expect(SITE_DESCRIPTION.length).toBeLessThanOrEqual(160);
  });
});

describe("route lists", () => {
  it("never lists a private route as public", () => {
    for (const route of PUBLIC_ROUTES) {
      expect(
        PRIVATE_ROUTE_PREFIXES.some(
          (prefix) => route.path === prefix || route.path.startsWith(`${prefix}/`)
        )
      ).toBe(false);
    }
  });

  it("uses real ISO dates for lastModified", () => {
    for (const route of PUBLIC_ROUTES) {
      expect(route.lastModified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(route.lastModified))).toBe(false);
    }
  });
});

describe("marketing facts stay in sync with the product", () => {
  it("derives counts and limits from the code that enforces them", () => {
    expect(PRODUCT_FACTS.currencyCount).toBe(SUPPORTED_CURRENCIES.length);
    expect(PRODUCT_FACTS.maxUploadMb).toBe(MAX_UPLOAD_MB);
  });

  it("matches the Pro price and free quota in the pricing plans", () => {
    const free = PRICING_PLANS.find((p) => p.id === "free")!;
    const pro = PRICING_PLANS.find((p) => p.id === "pro")!;
    expect(pro.priceMonthly).toBe(PRODUCT_FACTS.proPriceUsd);
    expect(free.priceMonthly).toBe(0);
    expect(free.features[0].label).toContain(String(PRODUCT_FACTS.freeDocumentsPerMonth));
    expect(PLAN_COMPARISON.find((r) => r.feature === "Documents per month")).toMatchObject({
      free: "10",
      pro: "Unlimited",
    });
  });

  it("formats plan prices as whole dollars", () => {
    expect(PRICING_PLANS.map(formatPlanPrice)).toEqual(["$0", "$5"]);
  });

  it("has unique feature titles, glance labels and FAQ questions", () => {
    const unique = (values: string[]) => new Set(values).size === values.length;
    expect(unique(FEATURES.map((f) => f.title))).toBe(true);
    expect(unique(GLANCE_FACTS.map((f) => f.label))).toBe(true);
    expect(unique([...PRODUCT_FAQ, ...PRICING_FAQ].map((f) => f.question))).toBe(true);
  });

  it("phrases every FAQ entry as a question with a self-contained answer", () => {
    for (const item of [...PRODUCT_FAQ, ...PRICING_FAQ]) {
      expect(item.question.endsWith("?")).toBe(true);
      // Answer engines quote 1–3 sentences; keep answers concise but complete.
      expect(item.answer.length).toBeGreaterThan(60);
      expect(item.answer.length).toBeLessThan(420);
    }
  });
});
