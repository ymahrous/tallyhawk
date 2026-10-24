<div align="center">

# Tallyhawk

**Tallyhawk, an AI-powered financial document processing platform: the web app and its API in one Next.js project.**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38BDF8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-tallyhawk.vercel.app-0070F3?logo=vercel&logoColor=white)](https://tallyhawk.vercel.app)

</div>

---

## Overview

Tallyhawk is a SaaS platform where solo founders and freelancers upload invoices and receipts to extract structured data, categorize spend, and sync directly to QuickBooks Online.

This repository is the whole product: the Next.js UI **and** its API. The REST API (formerly a separate FastAPI + Celery service, `tallyhawk-backend`) now runs as Next.js Route Handlers under `app/api/v1`, on the same origin as the pages. AI extraction runs in the background after an upload responds, using Next's `after()` instead of a Celery worker, so there's nothing else to deploy.

---

## Features

### Core Pipeline
- **Document dashboard** with drag-and-drop upload, live polling for processing status, and image thumbnails
- **QuickBooks Online Sync** — push extracted invoices directly to QBO as categorized Expenses with a single click
- **Installable app** — an optional "Install app" control (footer and account page) adds Tallyhawk to the home screen or Dock: the browser's own install dialog on Chrome, Edge and Android, step-by-step instructions on iPhone, iPad and Safari for Mac
- **Mobile Capture** — the installed app opens straight into the camera: snap a receipt and push it through the processing pipeline

### Data & Intelligence
- **Vendor Intelligence** — fuzzy-matches raw vendor strings against your known vendors and their aliases (≥ 80% similarity, e.g. "AMZN" → "Amazon"); renaming or merging a vendor re-labels its historical documents and keeps the old names as aliases for future matches
- **AI Tax Categorization** — automatic spend classification (Software, Travel, Meals, etc.) with manual override
- **Spend Analytics Dashboard** — interactive charts (monthly trend, top vendors, category breakdown) filterable by invoice date and month/year
- **Multi-Currency Support** — invoices are extracted in their original currency and shown converted into the user's chosen base currency, with the original amount always visible alongside it

### Account & Billing
- **Stripe Subscriptions** — free tier (10 docs/month) and a monthly Pro tier via Stripe Checkout. Pro switches on as soon as you return from checkout (the session is confirmed with Stripe directly, no sign-out needed); the Stripe Customer Portal handles card changes, invoices and cancellation; webhooks are idempotent and always apply the subscription's latest state
- **Email/password authentication** with JWT bearer tokens, a password policy enforced by both the forms and the API, a strength meter, server-side rate limiting of sign-in attempts, and a confirm-password flow
- **Session control** — changing or resetting a password signs out every other session; "sign out of all devices" and admin suspension revoke sessions immediately
- **Forgot/Reset Password** — secure, expiring, single-use token flow (only token hashes are stored) with HTML emails via Resend
- **Account page** for viewing session info, changing password, setting a base currency, managing billing and the QuickBooks connection, exporting tax summaries, installing the app, and deleting the account (behind an explicit no-refund, nothing-recoverable warning)

### Admin dashboard
- **Separate account type** — admins are their own accounts (`role = 'admin'`), never customers: they sign in on the same page but land on `/admin`, see admin-only navigation, and are refused by every customer endpoint (and customers by every admin endpoint)
- **Analytics** — customers, Pro, estimated MRR, past-due and canceling subscriptions, deleted accounts (churn), documents and failure rate, AI confidence, daily signups/uploads/support volume, category, currency and plan breakdowns, top uploaders
- **Customers** — search, filter and sort; per-customer usage, documents and Stripe subscription; grant or revoke Pro, suspend/reactivate, sign out everywhere, email a reset link, delete (cancelling Stripe billing first)
- **Deleted accounts** — a record of every deleted account: who deleted it and when, plan, lifetime documents, and the Stripe subscription, whose status the webhook keeps current after deletion (any subscription that would still bill a deleted account is cancelled automatically). Identifiers are removed after the retention period and the anonymized record is kept
- **Admins** — add admin accounts, suspend/reactivate or delete other admins (never yourself)
- **Support inboxes** — contact-form messages and feedback/bug reports with triage states, private notes and deletion
- **Documents** — every upload across customers (metadata only), with reprocessing of failed or stuck documents
- **Audit log** — every admin change, with who, what and when

### Security
- Role-separated authorization checked against the database on every request; sessions carry a token version so revocation is instant
- Postgres-backed rate limiting (works across serverless instances) on sign-in, signup, password reset, contact, feedback, upload and checkout; sign-in limits are per IP and per attempted email (existing or not), so lockouts can't reveal which emails are registered
- Strict security headers (CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy, Permissions-Policy) and `no-store` on API responses
- Uploads are checked by content (magic bytes), not just name, and stored under per-user unguessable paths
- A minimum-period data retention schedule (`lib/retention.ts`), enforced by a daily job and quoted by the privacy policy. Personal data is anonymized, not deleted, so statistics survive: deletion records lose the email, former id and Stripe ids after 120 days; contact messages and feedback lose sender details and text after 180 days; the admin audit log loses targets and IP hashes after 365 days. Stripe event ids are deleted after 30 days, reset links once expired or used, rate-limit counters after 1 hour
- Request body size limits, bounded inputs, CSV formula-injection escaping in tax exports, sign-in timing that doesn't reveal whether an email is registered, and a honeypot on the contact form

### UX & Design

### UX & Design
- **Dark/light theme** with system preference detection, cross-tab sync, and no flash on load
- **Responsive navigation** with a mobile menu, user avatar dropdown, and active-route highlighting
- **Global Feedback Widget** — expanding chat-bubble UI for suggestions, bug reports, or general feedback (linked to the customer's account when signed in)
- **Contact page** — a public form whose messages land in the admin inbox
- **Legal pages** (Terms of Service, Privacy Policy) written for the actual infrastructure this app runs on
- **Brand system** — a geometric hawk mark defined once in `lib/brand.ts`; favicons, app/PWA icons and the logo files are generated from it (`npm run brand:assets`)

### Search, answer & generative engine optimization
- **SEO** — complete per-route metadata (self-referencing canonicals, Open Graph, Twitter cards, robots directives) via `lib/seo.ts`, a per-page Open Graph image for every public route, a sitemap limited to indexable pages, and `noindex` on every signed-in or one-time page
- **Structured data** — schema.org JSON-LD graph (`Organization`, `WebSite`, `WebApplication` with plan `Offer`s, `FAQPage`, `HowTo`, `BreadcrumbList`) linked by stable `@id`s
- **AEO** — server-rendered landing and pricing pages with a definitional summary, an "at a glance" fact sheet, a how-it-works list, a plan comparison table and FAQs whose answers stay in the HTML while collapsed
- **GEO** — `/llms.txt` and `/llms-full.txt` for AI assistants, and `robots.txt` rules that explicitly welcome AI search and assistant crawlers while keeping private routes blocked

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS v4 |
| Charts | Recharts |
| Components | shadcn/ui, Radix UI primitives |
| Icons | lucide-react |
| API | Next.js Route Handlers (`app/api/v1`), background work via `after()` |
| Database | Postgres (Neon) via Drizzle ORM + `pg` |
| AI | Google Gemini 2.5 Flash (`@google/genai`) |
| Integrations | Stripe, QuickBooks Online, Supabase Storage, Resend, exchangerate-api.com |
| Language | TypeScript (strict mode) |
| Linting | ESLint (`eslint-config-next`), Prettier |
| Testing | Vitest + React Testing Library (jsdom), API tests on PGlite (in-process Postgres), Playwright + axe-core (e2e) |
| Git hooks | Husky + lint-staged |
| CI | GitHub Actions |
| Hosting | Vercel |

---

## Multi-Currency Support

Tallyhawk extracts the currency directly from each uploaded document and converts it into the user's preferred base currency, so amounts across the dashboard, analytics, and tax exports are shown in a single, consistent currency.

### Setting a base currency

Base currency is set from the **Account** page (`app/account/page.tsx`). It's a plain select of ISO 4217 codes (`USD`, `EUR`, `GBP`, etc.) backed by `GET`/`PATCH /api/v1/auth/settings` (`app/api/v1/auth/settings/route.ts`). There's no dedicated onboarding step for it — new accounts default to `USD` until changed here.

### Where currency shows up in the UI

| Surface | Component | Behavior |
|---|---|---|
| Document dashboard | `DocumentCard.tsx` | Shows the original and converted amounts side by side with the rate (e.g. "€100.00 → $108.50", "Rate: 1 EUR = 1.0850 USD"), a single figure when no conversion was needed, or the original with "Conversion pending" when no rate was available |
| Dashboard stats | `app/app/page.tsx` | "This Month" total in the currency the API reports (`base_currency` on `GET /stats/dashboard`), with a count of documents left out because they aren't converted yet |
| Spend analytics | `app/analytics/page.tsx` | Category, vendor, and monthly-trend charts are labeled and totaled in the base currency |
| Tax summary export | Account page → "Tax Export" | CSV with original and converted amounts per line and per-category totals in the base currency; documents without a current conversion are listed separately instead of being totaled |
| Account page | `app/account/page.tsx` | Base currency selector; a change saves immediately and re-converts existing documents in the background |

### Formatting

Amounts are formatted client-side with `Intl.NumberFormat(locale, { style: "currency", currency })`, using the currency code returned by the API for each amount (not a hardcoded `"USD"`), so original-currency and converted-currency figures both render with the correct symbol and decimal conventions.

### Changing your base currency

Changing your base currency on the Account page kicks off a background job (`reconvertUserCurrency()` in `server/pipeline.ts`) that re-converts all of your existing documents into the new currency. This settles within a few seconds, but there's no dedicated "reconversion complete" signal yet: the dashboard refreshes its stats and documents a few seconds after the change, and documents not yet reconverted are excluded from dashboard, analytics and tax-export totals (`excluded_from_month_spend` on `GET /api/v1/stats/dashboard`) rather than shown with a stale conversion, so totals may briefly undercount immediately after a currency change.

### Which date a document counts under

Analytics, the dashboard's "This Month" figure and the tax export all use the same rule: the invoice date the AI extracted (`YYYY-MM-DD`, `MM/DD/YYYY`, `DD/MM/YYYY` or `YYYY/MM/DD`), or the upload date when there isn't a readable one.

---

## Project Structure

```
tallyhawk/
├── app/
│   ├── page.tsx                 # Landing page (Server Component) + structured data
│   ├── layout.tsx               # Root layout: fonts, site-wide metadata/viewport, Organization JSON-LD
│   ├── globals.css              # Tailwind v4 theme, color-scheme, grid utility
│   ├── robots.ts / sitemap.ts   # Crawler rules (incl. AI crawlers) and indexable URLs
│   ├── manifest.ts              # PWA manifest (opens into /capture)
│   ├── llms.txt/ llms-full.txt/ # Markdown summaries for AI assistants
│   ├── opengraph-image.tsx      # Per-route OG images also live in each public route folder
│   ├── icon.svg, favicon.ico, apple-icon.png   # Generated by `npm run brand:assets`
│   ├── pricing/page.tsx         # Plans, comparison table, billing FAQ (Server Component)
│   ├── api/v1/                  # REST API (Route Handlers): auth, upload/documents, extraction, billing,
│   │                            #   quickbooks, vendors, stats, analytics, reports, feedback, admin
│   ├── app/                     # Customer dashboard (+ loading/error states)
│   ├── analytics/  vendors/  account/  capture/  billing/
│   ├── admin/                   # Admin dashboard: overview, users, admins, contact, feedback, documents, audit
│   ├── login/  signup/  forgot-password/  reset-password/
│   ├── contact/  privacy/  terms/  accessibility/
│   └── providers/               # Theme, Plan, Settings and CookieConsent contexts
├── components/
│   ├── brand/Logo.tsx           # Inline logo mark + wordmark
│   ├── marketing/               # Landing/pricing sections (FAQ, features, how it works, CTAs)
│   ├── pricing/PricingPlans.tsx # Plan cards + Stripe checkout (client island)
│   ├── seo/JsonLd.tsx           # Escaped JSON-LD <script>
│   ├── dashboard/               # DocumentCard, UploadZone, Alerts
│   ├── admin/                   # AdminShell (guard + nav), charts, inbox triage, shared admin UI
│   ├── contact/ContactForm.tsx  # Contact form (client island)
│   └── ui/                      # Navbar, Footer, SyncButton, UsageMeter, … + shadcn primitives
├── lib/
│   ├── api.ts  admin-api.ts     # API clients (same-origin /api/v1; admin endpoints)
│   ├── useAuthGuard.ts  useSessionRole.ts                     # Per-account-type page guard, role hook
│   ├── support.ts               # Feedback/contact rules shared by forms and API
│   ├── site.ts  seo.ts  structured-data.ts  llms.ts  og.tsx   # SEO/AEO/GEO building blocks
│   ├── brand.ts  pricing.ts  marketing.ts                     # Brand, plans and marketing copy
│   ├── currency.ts  uploads.ts  validation.ts  useIsLoggedIn.ts  utils.ts
├── server/                      # Server-only code behind the API
│   ├── db/                      # Drizzle schema + idempotent SQL migrations
│   ├── pipeline.ts              # Upload → Gemini → currency → vendor → duplicate/anomaly flags
│   ├── http.ts  auth.ts         # Route wrapper, errors, JWT/bcrypt, current account/customer/admin
│   ├── accounts.ts  billing.ts  # Sign-in, sessions, deletion; Stripe → subscription sync
│   ├── rate-limit.ts  audit.ts  admin.ts                      # Rate limits, admin audit log, admin helpers
│   └── …                        # currency, vendors (difflib port), detection, quickbooks, storage, ai, …
├── e2e/                         # Playwright specs (+ support/ fixtures with a mocked backend)
├── test/                        # Vitest helpers: fetch-level API mock, JWTs, router, providers
├── scripts/generate-brand-assets.mjs  db-migrate.mjs  create-admin.mjs
├── assets/fonts/                # Inter TTFs used to render OG images
├── playwright.config.ts
├── vitest.config.mts / vitest.setup.ts
└── .github/workflows/ci.yml     # Lint, typecheck, coverage, build + Playwright
```

---

## Local Development

### Prerequisites

- Node.js 24+ (the test toolchain requires ≥22.12; CI runs on 24)
- A Postgres database (e.g. Neon) plus keys for the services you want to exercise (Gemini, Supabase Storage, Stripe, QuickBooks, Resend) — see `.env.example`

### Setup

```bash
git clone https://github.com/ymahrous/tallyhawk.git
cd tallyhawk
npm install
cp .env.example .env.local
```

Fill in `.env.local` (at minimum `DATABASE_URL`, `SECRET_KEY`, the Supabase values and `GEMINI_API_KEY`), then create the tables and start the app:

```bash
npm run db:migrate   # idempotent; safe against the database the old FastAPI backend used
npm run admin:create -- you@example.com   # first admin account (prompts for a password)
npm run dev
```

Sign in at `/login` with the admin account to reach `/admin`; add further admins from the dashboard.

Open [http://localhost:3000](http://localhost:3000).

---

## Available Scripts

```bash
npm run dev            # Start the dev server
npm run build          # Production build
npm run start          # Start the production server
npm run db:migrate     # Create any missing tables/indexes (idempotent)
npm run admin:create -- <email>   # Create an admin account, or reset an admin's password
npm run lint           # Run ESLint
npm run typecheck      # tsc --noEmit
npm test               # Unit, component and integration tests (Vitest)
npm run test:watch     # Vitest in watch mode
npm run test:coverage  # Vitest with v8 coverage and enforced thresholds
npm run test:e2e       # Playwright end-to-end + accessibility suite (builds into .next-e2e)
npm run test:all       # Coverage run followed by the e2e suite
npm run brand:assets   # Regenerate favicons, app icons and logo files from lib/brand.ts
```

### Testing

- **Unit and integration (Vitest + RTL, jsdom)** — colocated `*.test.ts(x)` files. Page tests render real pages inside the real providers and fake the API at the `fetch` level (`test/api-mock.ts`), so `lib/api.ts` runs for real.
- **API (Vitest, node)** — `app/api/v1/**/*.test.ts` and `server/*.test.ts` call the route handlers directly against PGlite (Postgres compiled to WASM, in-process) with every real migration applied. Gemini, Stripe, Supabase, Resend and outbound HTTP are mocked. See `test/server.ts`.
- **End to end (Playwright)** — `e2e/*.spec.ts` against a production build. The build points `NEXT_PUBLIC_API_URL` at an unresolvable `.test` origin and every spec intercepts it, so the API is never hit. Covers SEO/crawler output and security headers, marketing journeys, auth, the dashboard, billing, analytics, the admin/customer split and axe-core WCAG 2.1 AA checks in light and dark themes, on desktop and mobile viewports.
- First-time e2e setup: `npx playwright install chromium`.

---

## Git Hooks

This repo uses Husky and lint-staged. On every commit:

- Staged `.ts`/`.tsx` files are linted with ESLint (`--fix`)
- Staged `.ts`, `.tsx`, `.json`, `.css`, `.md` files are formatted with Prettier

No setup needed — hooks are installed automatically via `npm install` (`prepare` script).

---

## Continuous Integration

Every push, and every pull request to `main`, runs two jobs:

1. **verify** — `npm run lint`, `npm run typecheck`, `npm run test:coverage` (fails below the coverage thresholds in `vitest.config.mts`), `npm run build`
2. **e2e** — installs Chromium and runs `npm run test:e2e`; the HTML report is uploaded as an artifact on failure

See `.github/workflows/ci.yml`. The build step reads `NEXT_PUBLIC_S3_BUCKET_URL` from repository secrets if it's there (the build also works without it). Server secrets are only read at request time, so CI needs none of them; the API tests run on an in-process Postgres.

---

## Deployment

Deployed to [Vercel](https://vercel.com) as a single project — pages and API together. Set the variables below (full list with comments in `.env.example`), run `npm run db:migrate` once against the database, and deploy.

After moving from the separate backend, also update these external settings to the new origin:

- **Stripe** webhook endpoint → `https://<your-domain>/api/v1/billing/webhook`, sending `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `customer.subscription.created/updated/deleted/paused/resumed`, `invoice.paid` and `invoice.payment_failed`
- **Stripe Customer Portal** → enable it in the Stripe dashboard (Settings → Billing → Customer portal), with cancellation "at the end of the billing period" so it matches the pricing FAQ
- **Retention job** → set `CRON_SECRET`; Vercel runs `/api/v1/cron/retention` daily from `vercel.json` (elsewhere, call it daily with `Authorization: Bearer $CRON_SECRET`)
- **Admins** → run `npm run db:migrate` (it promotes an existing `ADMIN_USERNAME` account to an admin account) or `npm run admin:create -- <email>`
- **Intuit** redirect URI and `QB_REDIRECT_URI` → `https://<your-domain>/api/v1/quickbooks/callback`
- Reuse the old backend's **`SECRET_KEY`** so existing sessions keep working (password hashes are compatible either way).

Uploads are processed after the response with `after()`; the upload route sets `maxDuration = 60` so Vercel keeps the function alive for the 10–30s Gemini call.

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | Postgres connection string |
| `SECRET_KEY` | ✅ | JWT signing key |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_ANON_KEY`), `SUPABASE_BUCKET_NAME` | ✅ | Document storage |
| `GEMINI_API_KEY` | ✅ | AI extraction |
| `EXCHANGE_RATE_API_KEY` | — | Currency conversion (amounts stay unconverted without it) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_PRO_MONTHLY` | — | Billing |
| `QB_CLIENT_ID`, `QB_CLIENT_SECRET`, `QB_REDIRECT_URI`, `QB_ENVIRONMENT` | — | QuickBooks sync |
| `RESEND_API_KEY`, `MAIL_FROM` | — | Password-reset email |
| `PRO_MONTHLY_PRICE_USD` | — | Price used for the admin dashboard's MRR estimate (defaults to the advertised Pro price) |
| `ADMIN_USERNAME` | — | Upgrade path only: `npm run db:migrate` turns this existing account into an admin account |
| `APP_URL` | — | Public origin for emails/redirects (defaults to the request origin) |
| `CRON_SECRET` | ✅ | Authorizes the daily data-retention job (`/api/v1/cron/retention`) |
| `NEXT_PUBLIC_S3_BUCKET_URL` | ✅ | Hostname allowed for document image previews (`next/image`); the build doesn't need it, but previews won't load without it |
| `NEXT_PUBLIC_SITE_URL` | — | Canonical origin for metadata, sitemap and structured data (defaults to `https://tallyhawk.vercel.app`) |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` / `NEXT_PUBLIC_BING_SITE_VERIFICATION` | — | Search Console / Bing Webmaster verification tokens |
| `NEXT_PUBLIC_API_URL` | — | Only to point the UI at a different API origin (tests use this) |

---

## Design Notes

**Theming** — An inline script in `app/layout.tsx` runs before React hydrates, reading `localStorage` and `prefers-color-scheme` to set the theme class on `<html>` immediately. This avoids a flash of the wrong theme on load. Theme changes are synced across browser tabs using the native `storage` event.

**Auth state** — JWT is stored in `localStorage`. Components that need to react to login/logout state (Navbar, landing page CTA) listen for `storage` events, which `logout()` dispatches manually to support same-tab updates. The token's `role` claim decides which app the UI shows (customer or admin); the API re-checks role, status and token version against the database on every request, so the claim is never trusted on its own.

**Vendor Normalization** — Each extraction links to a vendor via `vendor_id`, and the UI and analytics prefer the normalized `vendor.canonical_name`. Renaming or merging a vendor updates that record, rewrites `extracted_data.vendor` on its linked extractions to the new name (so duplicate detection and exports agree), and keeps the old names as aliases so future uploads still match.

**Currency formatting** — Every amount rendered in the UI carries its own currency code from the API response (original or converted); components never assume `"USD"`. This keeps original-currency figures (e.g. a receipt shown in `EUR`) formatted correctly even when the account's base currency is something else.

**Styling philosophy** — All components are styled directly with Tailwind utility classes and a small set of shared primitives (`PasswordToggle`, `UsageMeter`, `SyncButton`) rather than a heavy design system, keeping the bundle lean for a project this size.

---

## License

[MIT](./LICENSE)
