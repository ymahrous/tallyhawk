import { PRODUCT_FACTS } from "@/lib/site";

// Marketing copy lives here rather than in JSX so the landing page, FAQ structured data and
// llms.txt all state the same facts. Every claim must be backed by the product or the legal pages.

export interface FaqItem {
  question: string;
  answer: string;
}

export interface HowItWorksStep {
  title: string;
  description: string;
}

export type FeatureIcon =
  "extract" | "sync" | "tax" | "vendors" | "currency" | "flags" | "analytics" | "capture";

export interface Feature {
  icon: FeatureIcon;
  title: string;
  description: string;
}

export interface GlanceFact {
  label: string;
  value: string;
}

const { freeDocumentsPerMonth, proPriceUsd, maxUploadMb, currencyCount } = PRODUCT_FACTS;

export const HOW_IT_WORKS: readonly HowItWorksStep[] = [
  {
    title: "Upload or snap a receipt",
    description: `Drag PDFs, JPGs or PNGs (up to ${maxUploadMb} MB) onto the dashboard, or photograph a paper receipt with Mobile Capture on your phone.`,
  },
  {
    title: "AI extracts and categorizes it",
    description:
      "Tallyhawk reads the document and pulls out the vendor, total, date and currency, normalizes the vendor name and assigns a tax category.",
  },
  {
    title: "Sync to QuickBooks and export",
    description:
      "Push the expense to QuickBooks Online in one click, review spend analytics, and export a tax-ready CSV for your accountant.",
  },
];

export const FEATURES: readonly Feature[] = [
  {
    icon: "extract",
    title: "AI data extraction",
    description:
      "Vendor, total, date and currency pulled from PDFs and photos — no templates, no manual entry.",
  },
  {
    icon: "sync",
    title: "QuickBooks Online sync",
    description:
      "Push any processed document to QuickBooks as a categorized expense with one click, and see what's already synced.",
  },
  {
    icon: "tax",
    title: "Tax categorization",
    description:
      "Every expense lands in a category like Software, Travel or Meals. Override it anytime and export a tax summary CSV.",
  },
  {
    icon: "vendors",
    title: "Vendor intelligence",
    description:
      "“AMZN Mktp” and “Amazon.com” become one vendor. Rename or merge vendors and your history updates instantly.",
  },
  {
    icon: "currency",
    title: `${currencyCount} currencies`,
    description:
      "The currency is detected on each document and converted to your base currency, with the original amount and rate kept visible.",
  },
  {
    icon: "flags",
    title: "Duplicate & anomaly flags",
    description:
      "Possible duplicate receipts and unusual amounts are flagged on the dashboard so you can review them before they hit your books.",
  },
  {
    icon: "analytics",
    title: "Spend analytics",
    description:
      "Monthly spend trends, top vendors and category breakdowns, filterable by month and year.",
  },
  {
    icon: "capture",
    title: "Mobile capture",
    description:
      "Add Tallyhawk to your home screen and send receipts straight from your phone's camera into the pipeline.",
  },
];

export const GLANCE_FACTS: readonly GlanceFact[] = [
  {
    label: "What it is",
    value: "AI receipt & invoice processing (web app + installable mobile app)",
  },
  { label: "Built for", value: "Freelancers, consultants and small businesses" },
  { label: "Extracts", value: "Vendor, total, date, currency and tax category" },
  { label: "File types", value: `PDF, JPG and PNG up to ${maxUploadMb} MB` },
  { label: "Currencies", value: `${currencyCount}, converted to your base currency` },
  { label: "Integrations", value: "QuickBooks Online (Pro)" },
  { label: "Your data", value: "You own your documents; they are never used to train AI models" },
  {
    label: "Pricing",
    value: `Free for ${freeDocumentsPerMonth} documents/month · Pro $${proPriceUsd}/month`,
  },
];

export const PRODUCT_FAQ: readonly FaqItem[] = [
  {
    question: "What is Tallyhawk?",
    answer:
      "Tallyhawk is AI bookkeeping software that turns receipts and invoices into structured, tax-ready expense data. You upload a PDF or photo, Tallyhawk extracts the vendor, total, date and currency, assigns a tax category, and on the Pro plan syncs the expense to QuickBooks Online in one click.",
  },
  {
    question: "How does Tallyhawk extract data from receipts and invoices?",
    answer:
      "Each upload is queued and processed in the background by a large language model (Google Gemini). It reads the document, returns the vendor, total, date, currency and a suggested category, and normalizes messy vendor strings — for example “AMZN Mktp” becomes “Amazon”. The dashboard updates automatically when processing finishes.",
  },
  {
    question: "Does Tallyhawk work with QuickBooks Online?",
    answer:
      "Yes. Pro users connect QuickBooks Online through Intuit's secure OAuth flow from the Account page, then push any processed document to QuickBooks as a categorized expense with one click. Tallyhawk shows which documents are already synced.",
  },
  {
    question: "Which file types can I upload?",
    answer: `PDF, JPG and PNG files up to ${maxUploadMb} MB each. Drag and drop files onto the dashboard, or use Mobile Capture to photograph a receipt with your phone's camera.`,
  },
  {
    question: "Does Tallyhawk support multiple currencies?",
    answer: `Yes. Tallyhawk detects the currency printed on each document and converts the amount into your chosen base currency. ${currencyCount} currencies are supported, including USD, EUR, GBP, CAD, AUD and JPY, and the original amount and exchange rate stay visible next to the converted figure.`,
  },
  {
    question: "Is my financial data secure?",
    answer:
      "Passwords are hashed with bcrypt, sessions use short-lived JSON Web Tokens, QuickBooks OAuth tokens are encrypted at rest, and payments are handled entirely by Stripe, so Tallyhawk never sees your card number. Your documents are never used to train AI models.",
  },
  {
    question: "Is there a free plan?",
    answer: `Yes. The Free plan includes ${freeDocumentsPerMonth} documents per month with AI extraction, the document dashboard and mobile capture — no credit card required. Pro costs $${proPriceUsd} per month and adds unlimited documents, QuickBooks Online sync, tax categorization with CSV export, spend analytics and priority processing.`,
  },
  {
    question: "Does Tallyhawk replace my accountant?",
    answer:
      "No. Tallyhawk removes manual data entry, but AI extraction can make mistakes, so review extracted data before you file. The tax summary CSV export is designed to hand straight to your accountant or CPA.",
  },
  {
    question: "Can I delete my data?",
    answer:
      "Yes. You can delete individual documents at any time, or delete your whole account from Account Settings. Account data is purged from primary systems within 48 hours and from backups within 30 days.",
  },
];

export const PRICING_FAQ: readonly FaqItem[] = [
  {
    question: "How much does Tallyhawk cost?",
    answer: `Tallyhawk has two plans. Free costs $0 and includes ${freeDocumentsPerMonth} documents per month. Pro costs $${proPriceUsd} per month (USD) and includes unlimited documents, QuickBooks Online sync, tax categorization and CSV export, spend analytics and priority processing.`,
  },
  {
    question: "Do I need a credit card to start?",
    answer:
      "No. You can create a Free account with just an email address and password. You only enter payment details, through Stripe Checkout, when you upgrade to Pro.",
  },
  {
    question: "What happens when I reach the free limit?",
    answer: `Once you have processed ${freeDocumentsPerMonth} documents in a month on the Free plan, new uploads pause and the dashboard offers an upgrade to Pro for unlimited processing. Documents you've already processed stay available.`,
  },
  {
    question: "Can I cancel Pro at any time?",
    answer:
      "Yes. Cancel whenever you like and keep Pro features until the end of the current billing period. Partial refunds aren't provided for unused time.",
  },
  {
    question: "Which currency am I billed in?",
    answer: `All subscriptions are billed in US dollars (USD) through Stripe. Your documents can still be in any of the ${currencyCount} supported currencies.`,
  },
];
