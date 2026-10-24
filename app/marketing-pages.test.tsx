import { describe, it, expect, vi } from "vitest";
import { screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LandingPage, { metadata as homeMetadata } from "./page";
import PricingPage, { metadata as pricingMetadata } from "./pricing/page";
import PrivacyPolicy from "./privacy/page";
import TermsOfService from "./terms/page";
import AccessibilityStatement from "./accessibility/page";
import ContactPage from "./contact/page";
import NotFound from "./not-found";
import { metadata as rootMetadata, viewport } from "./layout";
import { renderWithProviders } from "@/test/render";
import { accountRoutes, mockApi } from "@/test/api-mock";
import { signIn } from "@/test/auth";
import { FEATURES, HOW_IT_WORKS, PRICING_FAQ, PRODUCT_FAQ } from "@/lib/marketing";
import { PLAN_COMPARISON } from "@/lib/pricing";
import { SITE_SUMMARY } from "@/lib/site";
import { RETENTION } from "@/lib/retention";

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
      "POST /billing/create-checkout-session": { status: 502, json: { detail: "Couldn't start checkout. Please try again." } },
    });
    renderWithProviders(<PricingPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Upgrade to Pro" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't start checkout. Please try again.");
    expect(screen.getByRole("button", { name: "Upgrade to Pro" })).toBeEnabled();
  });

  it("doesn't offer plans to admin accounts", async () => {
    signIn({ role: "admin", plan: undefined });
    const server = mockApi();
    renderWithProviders(<PricingPage />);
    const buttons = await screen.findAllByRole("button", { name: "Admin account" });
    expect(buttons).toHaveLength(2);
    buttons.forEach((b) => expect(b).toBeDisabled());
    expect(server.callsTo("GET /billing/usage")).toEqual([]);
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

  it("states the retention schedule the retention job enforces", () => {
    renderWithProviders(<PrivacyPolicy />);
    const retention = screen.getByRole("heading", { level: 2, name: "5. Data Retention" }).parentElement!;
    expect(retention).toHaveTextContent("only for the minimum period each purpose needs");
    expect(retention).toHaveTextContent("we anonymize it");
    expect(retention).toHaveTextContent(`After ${RETENTION.deletionRecordIdentifiersDays} days, longer than the usual window for disputing a card payment, the email address, account ID and Stripe identifiers are removed and only the anonymized record is kept`);
    expect(retention).toHaveTextContent(`Contact form messages and feedback: after ${RETENTION.supportMessageDays} days`);
    expect(retention).toHaveTextContent(`after ${RETENTION.auditLogIdentifiersDays} days, or when your deletion record is anonymized if that is sooner`);
    expect(retention).toHaveTextContent(`deleted after ${RETENTION.rateLimitHours} hour`);
    expect(retention).toHaveTextContent(`work for ${RETENTION.resetLinkMinutes} minutes`);
    expect(retention).toHaveTextContent(`from backups within ${RETENTION.backupDays} days`);
    // Deletion no longer offers refunds, so the record doesn't claim to be kept for them.
    expect(retention).not.toHaveTextContent(/handle refunds/i);
    const rights = screen.getByRole("heading", { level: 2, name: /4\. Your Data Rights/ }).parentElement!;
    expect(rights).toHaveTextContent(`anonymized after ${RETENTION.deletionRecordIdentifiersDays} days`);
    expect(rights).toHaveTextContent("Deleting your account does not entitle you to a refund");
  });

  it("says in the Terms that deleting an account is final and never refunded", () => {
    renderWithProviders(<TermsOfService />);
    const termination = screen.getByRole("heading", { level: 2, name: "12. Termination" }).parentElement!;
    expect(termination).toHaveTextContent("you will not be entitled to a refund, credit or other compensation for any payment made before the deletion");
    expect(termination).toHaveTextContent("cannot be restored");
    expect(termination).toHaveTextContent("kept and then anonymized as described in the Data Retention section of our Privacy Policy");
    const billing = screen.getByRole("heading", { level: 2, name: "4. Subscriptions and Billing" }).parentElement!;
    expect(billing).toHaveTextContent("deleting your account does not entitle you to a refund (see Section 12)");
    // Only a monthly plan exists (regression: the Terms promised annual billing too).
    expect(billing).not.toHaveTextContent("annual");
  });

  it("keeps the FAQs consistent with the Terms on refunds", () => {
    const deletion = PRODUCT_FAQ.find((f) => f.question === "Can I delete my data?")!;
    const cancel = PRICING_FAQ.find((f) => f.question === "Can I cancel Pro at any time?")!;
    expect(deletion.answer).toContain("doesn't entitle you to a refund");
    expect(deletion.answer).toContain(`kept for ${RETENTION.deletionRecordIdentifiersDays} days`);
    expect(cancel.answer).toContain("deleting your account doesn't entitle you to a refund");
  });
});

describe("contact page", () => {
  const fill = async (values: Record<string, string>) => {
    for (const [label, value] of Object.entries(values)) {
      const input = screen.getByLabelText(label);
      await userEvent.clear(input);
      if (value) await userEvent.type(input, value);
    }
  };

  it("renders a ContactPage with breadcrumb structured data", () => {
    const { container } = renderWithProviders(<ContactPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Get in touch" })).toBeInTheDocument();
    expect(jsonLdTypes(container)).toEqual(["ContactPage", "BreadcrumbList"]);
  });

  it("checks the fields before sending, then sends and confirms", async () => {
    const server = mockApi({ "POST /contact": { status: 201, json: { status: "success" } } });
    renderWithProviders(<ContactPage />);

    await userEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(screen.getByText("Please enter your name.")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
    expect(server.requests).toEqual([]);

    await fill({ Name: "Ada Lovelace", Email: "ada@example.com", Subject: "Billing question", Message: "Can I get a receipt for last month?" });
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Thanks, your message is on its way.");
    expect(server.callsTo("POST /contact")[0].body).toEqual({
      name: "Ada Lovelace",
      email: "ada@example.com",
      subject: "Billing question",
      message: "Can I get a receipt for last month?",
      website: "",
    });

    await userEvent.click(screen.getByRole("button", { name: "Send another message" }));
    expect(screen.getByLabelText("Name")).toHaveValue("");
  });

  it("keeps the honeypot out of reach and shows server errors", async () => {
    mockApi({ "POST /contact": { status: 429, json: { detail: "Too many requests. Please try again later." } } });
    renderWithProviders(<ContactPage />);
    const honeypot = document.getElementById("contact-website")!;
    expect(honeypot).toHaveAttribute("tabindex", "-1");
    expect(honeypot.closest("[aria-hidden='true']")).not.toBeNull();

    await fill({ Name: "Ada", Email: "ada@example.com", Subject: "Hi", Message: "Hello there, team!" });
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Too many requests");
    expect(screen.getByRole("button", { name: "Send message" })).toBeEnabled();
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
