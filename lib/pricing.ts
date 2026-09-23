export type PlanId = "free" | "pro";

export interface PlanFeature {
  label: string;
  included: boolean;
}

export interface PricingPlan {
  id: PlanId;
  name: string;
  priceMonthly: number;
  /** Billing is USD-only (see Terms §2 and §4), regardless of a document's currency. */
  currency: "USD";
  description: string;
  features: PlanFeature[];
  cta: string;
  highlight: boolean;
}

/** Single source for the pricing cards, comparison table, Offer structured data and llms.txt. */
export const PRICING_PLANS: readonly PricingPlan[] = [
  {
    id: "free",
    name: "Free",
    priceMonthly: 0,
    currency: "USD",
    description: "For solo freelancers just getting started.",
    features: [
      { label: "10 documents per month", included: true },
      { label: "AI data extraction", included: true },
      { label: "Document dashboard", included: true },
      { label: "Mobile receipt capture", included: true },
      { label: "QuickBooks Online sync", included: false },
      { label: "Tax categorization & CSV export", included: false },
      { label: "Spend analytics", included: false },
    ],
    cta: "Get started",
    highlight: false,
  },
  {
    id: "pro",
    name: "Pro",
    priceMonthly: 5,
    currency: "USD",
    description: "For power users who need automation and integrations.",
    features: [
      { label: "Unlimited documents", included: true },
      { label: "AI data extraction", included: true },
      { label: "QuickBooks Online sync", included: true },
      { label: "Tax categorization & CSV export", included: true },
      { label: "Spend analytics", included: true },
      { label: "Priority processing", included: true },
    ],
    cta: "Upgrade to Pro",
    highlight: true,
  },
];

export interface ComparisonRow {
  feature: string;
  /** true/false render as a check or cross; strings render as-is. */
  free: boolean | string;
  pro: boolean | string;
}

export const PLAN_COMPARISON: readonly ComparisonRow[] = [
  { feature: "Price", free: "$0", pro: "$5 / month" },
  { feature: "Documents per month", free: "10", pro: "Unlimited" },
  { feature: "AI data extraction", free: true, pro: true },
  { feature: "Document dashboard", free: true, pro: true },
  { feature: "Mobile receipt capture", free: true, pro: true },
  { feature: "QuickBooks Online sync", free: false, pro: true },
  { feature: "Tax categorization & CSV export", free: false, pro: true },
  { feature: "Spend analytics", free: false, pro: true },
  { feature: "Priority processing", free: false, pro: true },
];

export function formatPlanPrice(plan: Pick<PricingPlan, "priceMonthly">): string {
  return `$${plan.priceMonthly}`;
}
