import { test, expect } from "./support/fixtures";
import { PUBLIC_ROUTES } from "../lib/site";
import { PRODUCT_FAQ } from "../lib/marketing";

// Crawler's-eye view of the production build: raw HTML (no JavaScript), metadata routes and assets.

const ORIGIN = "https://tallyhawk.vercel.app";
const PRIVATE_PAGES = [
  "/app",
  "/account",
  "/analytics",
  "/vendors",
  "/capture",
  "/billing/success",
  "/forgot-password",
  "/reset-password",
];

function meta(html: string, attr: "name" | "property", key: string): string | null {
  const match = html.match(
    new RegExp(`<meta ${attr}="${key.replace(/[:.]/g, "\\$&")}" content="([^"]*)"`)
  );
  return match ? match[1] : null;
}

function canonical(html: string): string | null {
  return html.match(/<link rel="canonical" href="([^"]*)"/)?.[1] ?? null;
}

function jsonLdTypes(html: string): string[] {
  return [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].flatMap(
    (m) => {
      const data = JSON.parse(m[1]);
      return (data["@graph"] ?? [data]).map((node: { "@type": string }) => node["@type"]);
    }
  );
}

test.describe("server-rendered HTML", () => {
  test("home page ships its content and FAQ answers without JavaScript (for answer-engine crawlers)", async ({
    request,
  }) => {
    const html = await (await request.get("/")).text();
    expect(html).toContain("Turn receipts and invoices into");
    for (const faq of PRODUCT_FAQ) {
      expect(html).toContain(faq.question);
    }
    expect(html).toContain('<html lang="en"');
  });

  test("home page head is complete", async ({ request }) => {
    const html = await (await request.get("/")).text();
    expect(html).toMatch(
      /<title>Tallyhawk — AI Receipt &amp; Invoice Processing for QuickBooks<\/title>/
    );
    expect(meta(html, "name", "description")).toMatch(/^Upload receipts and invoices/);
    expect(canonical(html)).toMatch(new RegExp(`^${ORIGIN}/?$`));
    expect(meta(html, "property", "og:type")).toBe("website");
    expect(meta(html, "property", "og:site_name")).toBe("Tallyhawk");
    expect(meta(html, "name", "twitter:card")).toBe("summary_large_image");
    expect(meta(html, "name", "theme-color")).not.toBeNull();
    expect(jsonLdTypes(html)).toEqual(
      expect.arrayContaining([
        "Organization",
        "WebSite",
        "WebPage",
        "WebApplication",
        "HowTo",
        "FAQPage",
      ])
    );
  });

  for (const route of PUBLIC_ROUTES) {
    test(`${route.path} is indexable with a self-canonical and a working og:image`, async ({
      request,
    }) => {
      const response = await request.get(route.path);
      expect(response.status()).toBe(200);
      const html = await response.text();

      expect(canonical(html)).toBe(route.path === "/" ? ORIGIN : `${ORIGIN}${route.path}`);
      expect(meta(html, "name", "robots")).toBe("index, follow");
      expect(meta(html, "property", "og:url")).toBe(canonical(html));

      const ogImage = meta(html, "property", "og:image")!;
      expect(ogImage).toContain("/opengraph-image");
      expect(meta(html, "name", "twitter:image")).toBe(ogImage);
      const image = await request.get(ogImage.replace(ORIGIN, ""));
      expect(image.status()).toBe(200);
      expect(image.headers()["content-type"]).toBe("image/png");
    });
  }

  for (const path of PRIVATE_PAGES) {
    test(`${path} is noindex and has no canonical`, async ({ request }) => {
      const html = await (await request.get(path)).text();
      expect(meta(html, "name", "robots")).toBe("noindex, nofollow");
      expect(canonical(html)).toBeNull();
    });
  }

  test("unknown URLs return a real 404 marked noindex", async ({ request }) => {
    const response = await request.get("/definitely-not-a-page");
    expect(response.status()).toBe(404);
    expect(meta(await response.text(), "name", "robots")).toBe("noindex");
  });
});

test.describe("crawler files", () => {
  test("robots.txt blocks private routes, welcomes AI crawlers and links the sitemap", async ({
    request,
  }) => {
    const text = await (await request.get("/robots.txt")).text();
    expect(text).toContain("Disallow: /app$");
    expect(text).toContain("Disallow: /account");
    expect(text).not.toMatch(/^Disallow: \/app$/m);
    for (const bot of ["OAI-SearchBot", "PerplexityBot", "Claude-SearchBot", "GPTBot"]) {
      expect(text).toContain(`User-Agent: ${bot}`);
    }
    expect(text).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
  });

  test("sitemap.xml lists every public page and nothing else", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
    expect(locs).toEqual(PUBLIC_ROUTES.map((r) => `${ORIGIN}${r.path}`));
    for (const loc of locs) {
      expect((await request.get(loc.replace(ORIGIN, ""))).status()).toBe(200);
    }
  });

  test("llms.txt and llms-full.txt summarize the product for AI assistants", async ({
    request,
  }) => {
    const short = await request.get("/llms.txt");
    expect(short.headers()["content-type"]).toContain("text/plain");
    expect(await short.text()).toMatch(/^# Tallyhawk\n\n> Tallyhawk is AI bookkeeping software/);

    const full = await (await request.get("/llms-full.txt")).text();
    expect(full).toContain("## Frequently asked questions");
  });

  test("the web manifest and every icon it references resolve", async ({ request }) => {
    const manifest = await (await request.get("/manifest.webmanifest")).json();
    expect(manifest).toMatchObject({
      short_name: "Tallyhawk",
      start_url: "/capture",
      display: "standalone",
    });
    for (const icon of manifest.icons as { src: string }[]) {
      expect((await request.get(icon.src)).status()).toBe(200);
    }
  });

  test("favicons and the structured-data logo resolve", async ({ request }) => {
    for (const path of ["/favicon.ico", "/icon.svg", "/apple-icon.png", "/logo.png", "/logo.svg"]) {
      expect((await request.get(path)).status(), path).toBe(200);
    }
  });
});

test("rendered head links the favicon set and manifest", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveCount(1);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/manifest.webmanifest"
  );
});
