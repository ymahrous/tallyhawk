import { BRAND_NAME } from "@/lib/brand";
import { MAX_UPLOAD_MB } from "@/lib/uploads";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";

/** Canonical origin for URLs in metadata, sitemaps and structured data. Override per environment with NEXT_PUBLIC_SITE_URL. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://tallyhawk.vercel.app"
).replace(/\/+$/, "");

export const SITE_NAME = BRAND_NAME;
export const SITE_LOCALE = "en_US";
export const SITE_LANGUAGE = "en-US";

/** Home page <title>; every other page uses the "%s | Tallyhawk" template. */
export const SITE_TITLE = "Tallyhawk — AI Receipt & Invoice Processing for QuickBooks";

/** Meta description — kept under ~160 characters so search results don't truncate it. */
export const SITE_DESCRIPTION =
  "Upload receipts and invoices, let AI extract the vendor, amount, date and tax category, and sync expenses to QuickBooks Online. Free for 10 documents a month.";

/** Entity definition used by structured data and llms.txt — the sentence answer engines should quote. */
export const SITE_SUMMARY =
  "Tallyhawk is AI bookkeeping software for freelancers and small businesses. It turns receipts and invoices into structured, tax-ready expense data — extracting the vendor, total, date and currency, assigning a tax category, and syncing the expense to QuickBooks Online in one click.";

export const SOCIAL_LINKS = {
  github: "https://github.com/ymahrous",
} as const;

/** Verifiable product facts shared by marketing copy, structured data and llms.txt so they can't drift apart. */
export const PRODUCT_FACTS = {
  freeDocumentsPerMonth: 10,
  proPriceUsd: 5,
  maxUploadMb: MAX_UPLOAD_MB,
  fileTypes: ["PDF", "JPG", "PNG"],
  currencyCount: SUPPORTED_CURRENCIES.length,
  integrations: ["QuickBooks Online"],
} as const;

export interface PublicRoute {
  path: string;
  /** Last meaningful content change — not the build time, which would make the signal meaningless. */
  lastModified: string;
  changeFrequency: "weekly" | "monthly" | "yearly";
  priority: number;
}

/** Every indexable URL. Drives sitemap.xml and the llms.txt link lists; anything missing here is intentionally private. */
export const PUBLIC_ROUTES: readonly PublicRoute[] = [
  { path: "/", lastModified: "2026-09-23", changeFrequency: "weekly", priority: 1 },
  { path: "/pricing", lastModified: "2026-09-23", changeFrequency: "monthly", priority: 0.9 },
  { path: "/signup", lastModified: "2026-09-23", changeFrequency: "yearly", priority: 0.6 },
  { path: "/login", lastModified: "2026-09-23", changeFrequency: "yearly", priority: 0.4 },
  { path: "/privacy", lastModified: "2026-07-01", changeFrequency: "yearly", priority: 0.3 },
  { path: "/terms", lastModified: "2026-07-01", changeFrequency: "yearly", priority: 0.3 },
  { path: "/accessibility", lastModified: "2026-07-01", changeFrequency: "yearly", priority: 0.3 },
];

/** Signed-in app surfaces and one-time flows. Kept out of the index and out of crawlers' way. */
export const PRIVATE_ROUTE_PREFIXES = [
  "/app",
  "/account",
  "/analytics",
  "/vendors",
  "/capture",
  "/billing",
  "/reset-password",
] as const;

export function absoluteUrl(path = "/"): string {
  return new URL(path, `${SITE_URL}/`).toString();
}
