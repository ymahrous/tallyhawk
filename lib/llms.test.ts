import { describe, it, expect } from "vitest";
import { buildLlmsFullTxt, buildLlmsTxt } from "./llms";
import { PRICING_FAQ, PRODUCT_FAQ } from "./marketing";
import { SITE_SUMMARY } from "./site";

describe("buildLlmsTxt", () => {
  const text = buildLlmsTxt();

  it("follows the llms.txt shape: H1, blockquote summary, then H2 link sections", () => {
    const lines = text.split("\n");
    expect(lines[0]).toBe("# Tallyhawk");
    expect(lines[2]).toBe(`> ${SITE_SUMMARY}`);
    expect(text).toMatch(/^## Product$/m);
    expect(text).toMatch(/^## Optional$/m);
  });

  it("links only to absolute, public URLs", () => {
    const links = [...text.matchAll(/\]\((.+?)\)/g)].map((m) => m[1]);
    expect(links.length).toBeGreaterThan(5);
    for (const link of links) {
      expect(link).toMatch(/^https:\/\//);
      expect(link).not.toMatch(/\/(app|account|analytics|vendors|capture|billing)(\/|$)/);
    }
  });

  it("states both plans with their prices", () => {
    expect(text).toContain("**Free** — $0/month (USD)");
    expect(text).toContain("**Pro** — $5/month (USD)");
  });
});

describe("buildLlmsFullTxt", () => {
  it("includes every FAQ answer verbatim", () => {
    const text = buildLlmsFullTxt();
    for (const item of [...PRODUCT_FAQ, ...PRICING_FAQ]) {
      expect(text).toContain(`### ${item.question}`);
      expect(text).toContain(item.answer);
    }
  });
});
