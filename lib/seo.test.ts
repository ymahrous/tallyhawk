import { describe, it, expect } from "vitest";
import { INDEXABLE_ROBOTS, NOINDEX_ROBOTS, pageMetadata, privatePageMetadata } from "./seo";

describe("pageMetadata", () => {
  const metadata = pageMetadata({
    title: "Pricing",
    description: "Plans and prices.",
    path: "/pricing",
  });

  it("sets a canonical URL for the page", () => {
    expect(metadata.alternates).toEqual({ canonical: "/pricing" });
  });

  it("emits a complete Open Graph object so nothing is inherited from the home page", () => {
    expect(metadata.openGraph).toEqual({
      type: "website",
      locale: "en_US",
      siteName: "Tallyhawk",
      url: "/pricing",
      title: "Pricing | Tallyhawk",
      description: "Plans and prices.",
    });
  });

  it("emits a large Twitter card with matching copy", () => {
    expect(metadata.twitter).toEqual({
      card: "summary_large_image",
      title: "Pricing | Tallyhawk",
      description: "Plans and prices.",
    });
  });

  it("uses the title template by default and allows absolute titles", () => {
    expect(metadata.title).toBe("Pricing");
    const home = pageMetadata({
      title: "Tallyhawk — Home",
      description: "d",
      path: "/",
      absoluteTitle: true,
    });
    expect(home.title).toEqual({ absolute: "Tallyhawk — Home" });
    expect(home.openGraph?.title).toBe("Tallyhawk — Home");
  });

  it("allows indexing with rich snippets", () => {
    expect(metadata.robots).toBe(INDEXABLE_ROBOTS);
    expect(INDEXABLE_ROBOTS).toMatchObject({
      index: true,
      follow: true,
      googleBot: { "max-image-preview": "large", "max-snippet": -1 },
    });
  });
});

describe("privatePageMetadata", () => {
  it("is noindex and has no canonical", () => {
    const metadata = privatePageMetadata({ title: "Dashboard", description: "Your documents." });
    expect(metadata.robots).toBe(NOINDEX_ROBOTS);
    expect(NOINDEX_ROBOTS).toMatchObject({ index: false, follow: false });
    expect(metadata.alternates).toBeUndefined();
  });
});
