import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import robots, { AI_SEARCH_AGENTS, AI_TRAINING_AGENTS, disallowedPaths } from "./robots";
import sitemap from "./sitemap";
import manifest from "./manifest";
import { GET as getLlmsTxt } from "./llms.txt/route";
import { GET as getLlmsFullTxt } from "./llms-full.txt/route";
import { PUBLIC_ROUTES } from "@/lib/site";

// Crawler-facing metadata routes (robots.txt, sitemap.xml, manifest, llms.txt).

/** Minimal robots.txt matcher: longest matching rule wins, `$` anchors the end (Google semantics). */
function isAllowed(path: string, disallow: string[]): boolean {
  return !disallow.some((rule) =>
    rule.endsWith("$") ? path === rule.slice(0, -1) : path.startsWith(rule)
  );
}

describe("robots.txt", () => {
  const result = robots();
  const rules = Array.isArray(result.rules) ? result.rules : [result.rules];

  it("points crawlers at the sitemap", () => {
    expect(result.sitemap).toBe("https://tallyhawk.vercel.app/sitemap.xml");
  });

  it("blocks every private app route", () => {
    const disallow = disallowedPaths();
    for (const path of [
      "/app",
      "/app/",
      "/account",
      "/analytics",
      "/vendors",
      "/capture",
      "/billing/success",
      "/reset-password",
    ]) {
      expect(isAllowed(path, disallow)).toBe(false);
    }
  });

  it("does not accidentally block the apple touch icon with the /app rule", () => {
    expect(isAllowed("/apple-icon.png", disallowedPaths())).toBe(true);
  });

  it("allows every page in the sitemap", () => {
    for (const route of PUBLIC_ROUTES) {
      expect(isAllowed(route.path, disallowedPaths())).toBe(true);
    }
  });

  it("names AI search and assistant crawlers explicitly, with the same private-route rules", () => {
    const aiRule = rules.find(
      (rule) => Array.isArray(rule.userAgent) && rule.userAgent.includes("OAI-SearchBot")
    );
    expect(aiRule).toBeDefined();
    expect(aiRule!.userAgent).toEqual([...AI_SEARCH_AGENTS, ...AI_TRAINING_AGENTS]);
    expect(aiRule!.allow).toEqual(expect.arrayContaining(["/", "/llms.txt", "/llms-full.txt"]));
    expect(aiRule!.disallow).toEqual(disallowedPaths());
    for (const bot of ["PerplexityBot", "Claude-SearchBot", "ChatGPT-User", "GPTBot"]) {
      expect(aiRule!.userAgent).toContain(bot);
    }
  });
});

describe("sitemap.xml", () => {
  const entries = sitemap();

  it("lists exactly the public routes, as absolute URLs", () => {
    expect(entries.map((e) => e.url)).toEqual(
      PUBLIC_ROUTES.map((r) => `https://tallyhawk.vercel.app${r.path === "/" ? "/" : r.path}`)
    );
  });

  it("uses stable content dates instead of the build time", () => {
    const first = sitemap();
    expect(first.map((e) => (e.lastModified as Date).toISOString())).toEqual(
      entries.map((e) => (e.lastModified as Date).toISOString())
    );
    expect((entries[0].lastModified as Date).toISOString()).toBe(
      `${PUBLIC_ROUTES[0].lastModified}T00:00:00.000Z`
    );
  });

  it("gives the home page top priority", () => {
    expect(entries[0]).toMatchObject({ url: "https://tallyhawk.vercel.app/", priority: 1 });
  });
});

describe("web app manifest", () => {
  const result = manifest();

  it("keeps the capture flow as the install target and identity", () => {
    expect(result).toMatchObject({
      id: "/capture",
      start_url: "/capture",
      display: "standalone",
      short_name: "Tallyhawk",
    });
  });

  it("ships installable PNG icons, including a maskable one", () => {
    const sizes = result
      .icons!.filter((i) => i.type === "image/png")
      .map((i) => `${i.sizes}:${i.purpose}`);
    expect(sizes).toEqual(
      expect.arrayContaining(["192x192:any", "512x512:any", "512x512:maskable"])
    );
  });

  it("only references icon files that exist", () => {
    const sources = [
      ...result.icons!,
      ...(result.shortcuts ?? []).flatMap((s) => s.icons ?? []),
    ].map((i) => i.src);
    for (const src of sources) {
      const onDisk = src === "/icon.svg" ? join("app", "icon.svg") : join("public", src);
      expect(existsSync(join(__dirname, "..", onDisk))).toBe(true);
    }
  });
});

describe("llms.txt routes", () => {
  it.each([
    ["/llms.txt", getLlmsTxt],
    ["/llms-full.txt", getLlmsFullTxt],
  ])("%s serves UTF-8 plain text starting with the product name", async (_path, handler) => {
    const response = handler();
    expect(response.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    expect((await response.text()).startsWith("# Tallyhawk")).toBe(true);
  });
});
