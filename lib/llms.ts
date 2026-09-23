import {
  FEATURES,
  GLANCE_FACTS,
  HOW_IT_WORKS,
  PRICING_FAQ,
  PRODUCT_FAQ,
  type FaqItem,
} from "@/lib/marketing";
import { PRICING_PLANS, formatPlanPrice } from "@/lib/pricing";
import { SITE_NAME, SITE_SUMMARY, SOCIAL_LINKS, absoluteUrl } from "@/lib/site";

// llms.txt (https://llmstxt.org) gives AI assistants and answer engines a clean, markdown summary of
// the site so they can describe Tallyhawk accurately without parsing the rendered app. Built from the
// same constants as the pages, so it can't contradict them.

function planLines(): string[] {
  return PRICING_PLANS.map((plan) => {
    const included = plan.features.filter((f) => f.included).map((f) => f.label.toLowerCase());
    return `- **${plan.name}** — ${formatPlanPrice(plan)}/month (${plan.currency}): ${included.join(", ")}.`;
  });
}

function faqBlock(items: readonly FaqItem[]): string[] {
  return items.flatMap((item) => [`### ${item.question}`, "", item.answer, ""]);
}

export function buildLlmsTxt(): string {
  return [
    `# ${SITE_NAME}`,
    "",
    `> ${SITE_SUMMARY}`,
    "",
    ...GLANCE_FACTS.map((fact) => `- ${fact.label}: ${fact.value}`),
    "",
    "## Product",
    "",
    `- [Home](${absoluteUrl("/")}): Overview, how it works, features and FAQ`,
    `- [Pricing](${absoluteUrl("/pricing")}): Free and Pro plans, plan comparison and billing FAQ`,
    `- [Sign up](${absoluteUrl("/signup")}): Create a free account (no credit card required)`,
    `- [Log in](${absoluteUrl("/login")}): Sign in to the dashboard`,
    "",
    "## Plans",
    "",
    ...planLines(),
    "",
    "## Policies",
    "",
    `- [Privacy Policy](${absoluteUrl("/privacy")}): Data collected, sub-processors, retention and your rights (GDPR, CCPA/CPRA, PIPEDA)`,
    `- [Terms of Service](${absoluteUrl("/terms")}): Billing, acceptable use and AI accuracy disclaimer`,
    `- [Accessibility](${absoluteUrl("/accessibility")}): WCAG 2.1 AA conformance target and known limitations`,
    "",
    "## Optional",
    "",
    `- [Full reference](${absoluteUrl("/llms-full.txt")}): Features, workflow and complete FAQ in one document`,
    `- [Source code](${SOCIAL_LINKS.github}): Maintainer's GitHub profile`,
    "",
  ].join("\n");
}

export function buildLlmsFullTxt(): string {
  return [
    `# ${SITE_NAME} — full reference`,
    "",
    `> ${SITE_SUMMARY}`,
    "",
    `Canonical site: ${absoluteUrl("/")}`,
    "",
    "## At a glance",
    "",
    ...GLANCE_FACTS.map((fact) => `- **${fact.label}:** ${fact.value}`),
    "",
    "## How it works",
    "",
    ...HOW_IT_WORKS.map((step, index) => `${index + 1}. **${step.title}.** ${step.description}`),
    "",
    "## Features",
    "",
    ...FEATURES.map((feature) => `- **${feature.title}:** ${feature.description}`),
    "",
    "## Plans and pricing",
    "",
    ...planLines(),
    "",
    `Details: ${absoluteUrl("/pricing")}`,
    "",
    "## Frequently asked questions",
    "",
    ...faqBlock(PRODUCT_FAQ),
    "## Billing questions",
    "",
    ...faqBlock(PRICING_FAQ),
  ].join("\n");
}
