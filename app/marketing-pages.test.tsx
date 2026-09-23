import { describe, it, expect, vi } from "vitest";
import { screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LandingPage, { metadata as homeMetadata } from "./page";
import PricingPage, { metadata as pricingMetadata } from "./pricing/page";
import PrivacyPolicy from "./privacy/page";
import TermsOfService from "./terms/page";
import AccessibilityStatement from "./accessibility/page";
import NotFound from "./not-found";
import { metadata as rootMetadata, viewport } from "./layout";
import { renderWithProviders } from "@/test/render";
import { accountRoutes, mockApi } from "@/test/api-mock";
import { signIn } from "@/test/auth";
import { FEATURES, HOW_IT_WORKS, PRICING_FAQ, PRODUCT_FAQ } from "@/lib/marketing";
import { PLAN_COMPARISON } from "@/lib/pricing";
import { SITE_SUMMARY } from "@/lib/site";

// next/font is a compile-time transform; outside Next it isn't callable.
vi.mock("next/font/google", () => ({
  Inter: () => ({ className: "font-inter", variable: "--font-inter" }),
  JetBrains_Mono: () => ({ className: "font-jetbrains", variable: "--font-jetbrains" }),
}));

function jsonLdTypes(container: HTMLElement): string[] {
  return [...container.querySelectorAll('script[type="application/ld+json"]')].flatMap((script) => {
    const data = JSON.parse(script.textContent!);
    return (data["@graph"] ?? [data]).map((node: { "@type": string }) => node["@type"]);
  });
}

describe("root layout metadata", () => {
  it("does not set a site-wide canonical that every page would inherit", () => {
    expect(rootMetadata.alternates).toBeUndefined();
  });

  it("uses a title template, the canonical origin and theme colors for both schemes", () => {
    expect(rootMetadata.title).toMatchObject({ template: "%s | Tallyhawk" });
    expect(rootMetadata.metadataBase?.toString()).toBe("https://tallyhawk.vercel.app/");
    expect(viewport.themeColor).toHaveLength(2);
  });
});

describe("landing page", () => {
  it("has one h1 with the core keywords and a definitional summary", () => {
    renderWithProviders(<LandingPage />);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1).toHaveTextContent("Turn receipts and invoices into tax-ready books");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByText(SITE_SUMMARY)).toBeInTheDocument();
  });

  it("sends visitors to signup and pricing through real links", () => {
    renderWithProviders(<LandingPage />);
    expect(screen.getByRole("link", { name: "Start free" })).toHaveAttribute("href", "/signup");
    expect(screen.getByRole("link", { name: "See pricing" })).toHaveAttribute("href", "/pricing");
    expect(screen.getByRole("link", { name: "Get started for free" })).toHaveAttribute(
      "href",
      "/signup"
    );
  });

  it("swaps the CTAs to the dashboard for signed-in visitors", async () => {
    signIn();
    mockApi(accountRoutes());
    renderWithProviders(<LandingPage />);
    const dashboardLinks = await screen.findAllByRole("link", { name: "Open dashboard" });
    expect(dashboardLinks).toHaveLength(2);
    dashboardLinks.forEach((link) => expect(link).toHaveAttribute("href", "/app"));
    expect(screen.queryByRole("link", { name: "Start free" })).toBeNull();
  });

  it("renders every step, feature and FAQ from the shared content", () => {
    renderWithProviders(<LandingPage />);
    const steps = within(document.getElementById("how-it-works")!).getAllByRole("listitem");
    expect(steps).toHaveLength(HOW_IT_WORKS.length);
    for (const feature of FEATURES)
      expect(screen.getByRole("heading", { name: feature.title })).toBeInTheDocument();
    for (const faq of PRODUCT_FAQ)
      expect(screen.getByRole("heading", { name: faq.question })).toBeInTheDocument();
  });

  it("keeps FAQ answers in the DOM while collapsed and expands them on click", async () => {
    renderWithProviders(<LandingPage />);
    const first = screen.getByRole("heading", { name: PRODUCT_FAQ[0].question });
    const details = first.closest("details")!;
    expect(details.open).toBe(false);
    expect(details).toHaveTextContent(PRODUCT_FAQ[0].answer);

    await userEvent.click(first);
    expect(details.open).toBe(true);
  });

  it("exposes the fact sheet as a definition list", () => {
    renderWithProviders(<LandingPage />);
    const glance = screen.getByRole("heading", { name: /Everything you need to know/ });
    const list = document.querySelector(`dl[aria-labelledby="${glance.id}"]`)!;
    expect(within(list as HTMLElement).getByText("File types")).toBeInTheDocument();
  });

  it("embeds WebPage, WebApplication, HowTo and FAQPage structured data", () => {
    const { container } = renderWithProviders(<LandingPage />);
    expect(jsonLdTypes(container)).toEqual(["WebPage", "WebApplication", "HowTo", "FAQPage"]);
  });

  it("is the canonical home page", () => {
    expect(homeMetadata.alternates).toEqual({ canonical: "/" });
    expect(homeMetadata.title).toEqual({
      absolute: "Tallyhawk — AI Receipt & Invoice Processing for QuickBooks",
    });
  });
});

describe("pricing page", () => {
  it("renders both plans, the comparison table and billing FAQ", () => {
    renderWithProviders(<PricingPage />);
    expect(screen.getByRole("heading", { level: 2, name: "Free" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Pro" })).toBeInTheDocument();

    const table = screen.getByRole("table", { name: "Tallyhawk Free and Pro plan comparison" });
    expect(within(table).getAllByRole("row")).toHaveLength(PLAN_COMPARISON.length + 1);
    expect(within(table).getAllByText("Not included")).toHaveLength(
      PLAN_COMPARISON.filter((row) => row.free === false).length
    );

    for (const faq of PRICING_FAQ)
      expect(screen.getByRole("heading", { name: faq.question })).toBeInTheDocument();
  });

  it("sends signed-out visitors to signup (Free) and login (Pro) via links", () => {
    renderWithProviders(<PricingPage />);
    expect(screen.getByRole("link", { name: "Get started" })).toHaveAttribute("href", "/signup");
    expect(screen.getByRole("link", { name: "Upgrade to Pro" })).toHaveAttribute("href", "/login");
  });

  it("marks the signed-in user's current plan and starts Stripe checkout for Pro", async () => {
    signIn({ plan: "free" });
    const server = mockApi({
      ...accountRoutes({ plan: "free" }),
      "POST /billing/create-checkout-session": {
        json: { url: "https://checkout.stripe.test/session" },
      },
    });
    renderWithProviders(<PricingPage />);

    expect(await screen.findByRole("button", { name: "Current plan" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Upgrade to Pro" }));

    await waitFor(() =>
      expect(server.callsTo("POST /billing/create-checkout-session")).toHaveLength(1)
    );
  });

  it("shows an inline error when checkout can't start", async () => {
    signIn({ plan: "free" });
    mockApi({
      ...accountRoutes({ plan: "free" }),
      "POST /billing/create-checkout-session": { status: 500, json: {} },
    });
    renderWithProviders(<PricingPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Upgrade to Pro" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't start checkout");
    expect(screen.getByRole("button", { name: "Upgrade to Pro" })).toBeEnabled();
  });

  it("shows Pro as current and Free as included for Pro users", async () => {
    signIn({ plan: "pro" });
    mockApi(accountRoutes({ plan: "pro" }));
    renderWithProviders(<PricingPage />);
    expect(await screen.findByRole("button", { name: "Current plan" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Included in Pro" })).toBeDisabled();
  });

  it("falls back to the JWT plan when usage can't be loaded", async () => {
    signIn({ plan: "pro" });
    mockApi({ "GET /billing/usage": { status: 500 } });
    renderWithProviders(<PricingPage />);
    expect(await screen.findByRole("button", { name: "Current plan" })).toBeInTheDocument();
  });

  it("embeds breadcrumb, offers and FAQ structured data with a canonical URL", () => {
    const { container } = renderWithProviders(<PricingPage />);
    expect(jsonLdTypes(container)).toEqual([
      "WebPage",
      "BreadcrumbList",
      "WebApplication",
      "FAQPage",
    ]);
    expect(pricingMetadata.alternates).toEqual({ canonical: "/pricing" });
    expect(pricingMetadata.openGraph).toMatchObject({
      url: "/pricing",
      title: "Pricing | Tallyhawk",
    });
  });
});

describe("legal pages", () => {
  it.each([
    ["Privacy Policy", PrivacyPolicy, "11. Contact"],
    ["Terms of Service", TermsOfService, "16. International Use"],
    ["Accessibility Statement", AccessibilityStatement, "5. Feedback"],
  ])("%s renders its title and every section", (title, Page, lastSection) => {
    renderWithProviders(<Page />);
    expect(screen.getByRole("heading", { level: 1, name: title })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: lastSection })).toBeInTheDocument();
  });
});

describe("not-found page", () => {
  it("offers crawlable ways back", () => {
    renderWithProviders(<NotFound />);
    expect(screen.getByRole("heading", { name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "View pricing" })).toHaveAttribute("href", "/pricing");
  });
});
