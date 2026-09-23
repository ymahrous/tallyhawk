import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import type { Metadata } from "next";
import { PUBLIC_ROUTES } from "@/lib/site";
import * as accessibility from "./accessibility/layout";
import * as privacy from "./privacy/layout";
import * as terms from "./terms/layout";
import * as signup from "./signup/layout";
import * as login from "./login/layout";
import * as pricing from "./pricing/page";
import * as home from "./page";
import * as forgotPassword from "./forgot-password/layout";
import * as resetPassword from "./reset-password/layout";
import * as account from "./account/layout";
import * as analytics from "./analytics/layout";
import * as dashboard from "./app/layout";
import * as capture from "./capture/layout";
import * as vendors from "./vendors/layout";
import * as billing from "./billing/layout";

const PUBLIC: Record<string, { metadata: Metadata }> = {
  "/": home,
  "/pricing": pricing,
  "/signup": signup,
  "/login": login,
  "/privacy": privacy,
  "/terms": terms,
  "/accessibility": accessibility,
};

const PRIVATE = {
  forgotPassword,
  resetPassword,
  account,
  analytics,
  dashboard,
  capture,
  vendors,
  billing,
};

describe("public route metadata", () => {
  it("covers exactly the routes in the sitemap", () => {
    expect(Object.keys(PUBLIC).sort()).toEqual(PUBLIC_ROUTES.map((r) => r.path).sort());
  });

  it.each(Object.entries(PUBLIC))(
    "%s is indexable with a self-referencing canonical and complete social tags",
    (path, { metadata }) => {
      expect(metadata.robots).toMatchObject({ index: true, follow: true });
      expect(metadata.alternates?.canonical).toBe(path);
      expect(metadata.openGraph).toMatchObject({
        url: path,
        siteName: "Tallyhawk",
        type: "website",
      });
      expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
      expect(String(metadata.description).length).toBeGreaterThanOrEqual(70);
      expect(String(metadata.description).length).toBeLessThanOrEqual(170);
    }
  );

  it("gives every public page a unique title and description", () => {
    const titles = Object.values(PUBLIC).map(({ metadata }) => JSON.stringify(metadata.title));
    const descriptions = Object.values(PUBLIC).map(({ metadata }) => metadata.description);
    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(descriptions).size).toBe(descriptions.length);
  });

  it.each([
    ["/privacy", privacy],
    ["/terms", terms],
    ["/accessibility", accessibility],
    ["/signup", signup],
    ["/login", login],
  ])("%s layout renders its page plus WebPage + BreadcrumbList structured data", (path, layout) => {
    const { container } = render(
      <layout.default>
        <p>content</p>
      </layout.default>
    );
    const data = JSON.parse(
      container.querySelector('script[type="application/ld+json"]')!.textContent!
    );
    expect(data["@graph"].map((n: { "@type": string }) => n["@type"])).toEqual([
      "WebPage",
      "BreadcrumbList",
    ]);
    expect(data["@graph"][0].url).toBe(`https://tallyhawk.vercel.app${path}`);
    expect(container).toHaveTextContent("content");
  });
});

describe("private route metadata", () => {
  it.each(Object.entries(PRIVATE))("%s is noindex without a canonical", (_name, layout) => {
    expect(layout.metadata.robots).toMatchObject({ index: false, follow: false });
    expect(layout.metadata.alternates).toBeUndefined();
    const { container } = render(
      <layout.default>
        <p>child</p>
      </layout.default>
    );
    expect(container).toHaveTextContent("child");
  });
});
