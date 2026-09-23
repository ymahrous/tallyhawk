<div align="center">

# Tallyhawk

**The web client for Tallyhawk, an AI-powered financial document processing platform.**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38BDF8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-tallyhawk.vercel.app-0070F3?logo=vercel&logoColor=white)](https://tallyhawk.vercel.app)

</div>

---

## Overview

This is the Next.js frontend for Tallyhawk, a SaaS platform where solo founders and freelancers upload invoices and receipts to extract structured data, categorize spend, and sync directly to QuickBooks Online.

This repository contains the client only. It talks to the [Tallyhawk backend](https://github.com/ymahrous/tallyhawk-backend) (FastAPI + Celery + Google Gemini) over a REST API and renders no AI logic itself.

---

## Features

### Core Pipeline
- **Document dashboard** with drag-and-drop upload, live polling for processing status, and expanding image previews
- **QuickBooks Online Sync** — push extracted invoices directly to QBO as categorized Expenses with a single click
- **Mobile Capture PWA** — snap a photo of a receipt on a desk and push it straight through the processing pipeline

### Data & Intelligence
- **Vendor Intelligence** — AI fuzzy-matches raw vendor strings (e.g., "AMZN" → "Amazon"); users can merge and rename vendors while the system keeps historical data perfectly intact
- **AI Tax Categorization** — automatic spend classification (Software, Travel, Meals, etc.) with manual override
- **Spend Analytics Dashboard** — interactive charts (monthly trend, top vendors, category breakdown) filterable by invoice date and month/year
- **Multi-Currency Support** — invoices are extracted in their original currency and shown converted into the user's chosen base currency, with the original amount always visible alongside it

### Account & Billing
- **Stripe Subscriptions** — free tier (10 docs/month) and Pro tier with checkout sessions and billing portal
- **Email/password authentication** with JWT bearer tokens, password strength validation, rate-limited login attempts, and a confirm-password flow
- **Forgot/Reset Password** — secure, expiring token flow with HTML emails via Resend
- **Account page** for viewing session info, changing password, setting a base currency, managing QuickBooks connection, and exporting tax summaries

### UX & Design
- **Dark/light theme** with system preference detection, cross-tab sync, and no flash on load
- **Responsive navigation** with a mobile menu, user avatar dropdown, and active-route highlighting
- **Global Feedback Widget** — expanding chat-bubble UI for suggestions, bug reports, or general feedback
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
| Language | TypeScript (strict mode) |
| Linting | ESLint (`eslint-config-next`), Prettier |
| Testing | Vitest + React Testing Library (jsdom), Playwright + axe-core (e2e) |
| Git hooks | Husky + lint-staged |
| CI | GitHub Actions |
| Hosting | Vercel |

---

## Multi-Currency Support

Tallyhawk extracts the currency directly from each uploaded document and converts it into the user's preferred base currency, so amounts across the dashboard, analytics, and tax exports are shown in a single, consistent currency.

### Setting a base currency

Base currency is set from the **Account** page (`app/account/page.tsx`). It's a plain select of ISO 4217 codes (`USD`, `EUR`, `GBP`, etc.) backed by `GET`/`PATCH /api/v1/auth/settings` on the backend (see `lib/api.ts`). There's no dedicated onboarding step for it — new accounts default to `USD` until changed here.

### Where currency shows up in the UI

| Surface | Component | Behavior |
|---|---|---|
| Document dashboard | `DocumentCard.tsx` | Shows the converted amount in the user's base currency as the primary figure, with the original amount + currency shown as secondary text (e.g. "$108.50 — converted from €100.00") |
| Spend analytics | `app/analytics/page.tsx` | Category, vendor, and monthly-trend charts are labeled and totaled in the base currency |
| Tax summary export | Account page → "Export tax summary" | CSV download shows both original and converted amounts per line, plus a category summary total in the base currency |
| Account page | `app/account/page.tsx` | Base currency selector; changing it takes effect for documents processed afterward |

### Formatting

Amounts are formatted client-side with `Intl.NumberFormat(locale, { style: "currency", currency })`, using the currency code returned by the API for each amount (not a hardcoded `"USD"`), so original-currency and converted-currency figures both render with the correct symbol and decimal conventions.

### Changing your base currency

Changing your base currency on the Account page kicks off a background job on the backend that re-converts all of your existing documents into the new currency. This settles within a few seconds, but there's no dedicated "reconversion complete" signal yet — documents not yet reconverted are excluded from dashboard/analytics totals (`excluded_from_month_spend` on `GET /api/v1/stats/dashboard`) rather than shown with a stale conversion, so totals may briefly undercount immediately after a currency change.

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
│   ├── app/                     # Authenticated dashboard (+ loading/error states)
│   ├── analytics/  vendors/  account/  capture/  billing/
│   ├── login/  signup/  forgot-password/  reset-password/
│   ├── privacy/  terms/  accessibility/
│   └── providers/               # Theme, Plan, Settings and CookieConsent contexts
├── components/
│   ├── brand/Logo.tsx           # Inline logo mark + wordmark
│   ├── marketing/               # Landing/pricing sections (FAQ, features, how it works, CTAs)
│   ├── pricing/PricingPlans.tsx # Plan cards + Stripe checkout (client island)
│   ├── seo/JsonLd.tsx           # Escaped JSON-LD <script>
│   ├── dashboard/               # DocumentCard, UploadZone, Alerts
│   └── ui/                      # Navbar, Footer, SyncButton, UsageMeter, … + shadcn primitives
├── lib/
│   ├── api.ts                   # Backend API client
│   ├── site.ts  seo.ts  structured-data.ts  llms.ts  og.tsx   # SEO/AEO/GEO building blocks
│   ├── brand.ts  pricing.ts  marketing.ts                     # Brand, plans and marketing copy
│   ├── currency.ts  uploads.ts  validation.ts  useIsLoggedIn.ts  utils.ts
├── e2e/                         # Playwright specs (+ support/ fixtures with a mocked backend)
├── test/                        # Vitest helpers: fetch-level API mock, JWTs, router, providers
├── scripts/generate-brand-assets.mjs
├── assets/fonts/                # Inter TTFs used to render OG images
├── playwright.config.ts
├── vitest.config.mts / vitest.setup.ts
└── .github/workflows/ci.yml     # Lint, typecheck, coverage, build + Playwright
```

---

## Local Development

### Prerequisites

- Node.js 24+ (the test toolchain requires ≥22.12; CI runs on 24)
- A running instance of the [Tallyhawk backend](https://github.com/ymahrous/tallyhawk-backend), locally or deployed

### Setup

```bash
git clone https://github.com/ymahrous/tallyhawk.git
cd tallyhawk
npm install
cp .env.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Available Scripts

```bash
npm run dev            # Start the dev server
npm run build          # Production build
npm run start          # Start the production server
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

- **Unit and integration (Vitest + RTL, jsdom)** — colocated `*.test.ts(x)` files. Page tests render real pages inside the real providers and fake the backend at the `fetch` level (`test/api-mock.ts`), so `lib/api.ts` runs for real.
- **End to end (Playwright)** — `e2e/*.spec.ts` against a production build. The build points `NEXT_PUBLIC_API_URL` at an unresolvable `.test` origin and every spec intercepts it, so no backend is needed. Covers SEO/crawler output, marketing journeys, auth, the dashboard, billing, analytics and axe-core WCAG 2.1 AA checks in light and dark themes, on desktop and mobile viewports.
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

See `.github/workflows/ci.yml`. The build step reads `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, and `NEXT_PUBLIC_S3_BUCKET_URL` from repository secrets — add them under Settings → Secrets and variables → Actions so the built bundle points at a reachable backend.

---

## Deployment

Deployed to [Vercel](https://vercel.com). Connect the repository, set `NEXT_PUBLIC_API_URL` to the deployed backend's URL, and deploy — no additional configuration required.

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | ✅ | Base URL of the Tallyhawk backend API |
| `NEXT_PUBLIC_S3_BUCKET_URL` | ✅ | Hostname allowed for document image previews (`next/image`) |
| `NEXT_PUBLIC_SITE_URL` | — | Canonical origin for metadata, sitemap and structured data (defaults to `https://tallyhawk.vercel.app`) |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` / `NEXT_PUBLIC_BING_SITE_VERIFICATION` | — | Search Console / Bing Webmaster verification tokens |

---

## Design Notes

**Theming** — An inline script in `app/layout.tsx` runs before React hydrates, reading `localStorage` and `prefers-color-scheme` to set the theme class on `<html>` immediately. This avoids a flash of the wrong theme on load. Theme changes are synced across browser tabs using the native `storage` event.

**Auth state** — JWT is stored in `localStorage`. Components that need to react to login/logout state (Navbar, landing page CTA) listen for `storage` events, which `logout()` dispatches manually to support same-tab updates.

**Vendor Normalization** — The raw vendor string from the AI is stored in `extracted_data` for auditing, but the UI and analytics always prefer the normalized `vendor.canonical_name` via a SQLModel relationship. This means renaming or merging a vendor instantly updates all historical documents and charts without mutating historical JSON blobs.

**Currency formatting** — Every amount rendered in the UI carries its own currency code from the API response (original or converted); components never assume `"USD"`. This keeps original-currency figures (e.g. a receipt shown in `EUR`) formatted correctly even when the account's base currency is something else.

**Styling philosophy** — All components are styled directly with Tailwind utility classes and a small set of shared primitives (`PasswordToggle`, `UsageMeter`, `SyncButton`) rather than a heavy design system, keeping the bundle lean for a project this size.

---

## Related Repositories

- [tallyhawk-backend](https://github.com/ymahrous/tallyhawk-backend) — FastAPI + Celery + Google Gemini backend

---

## License

[MIT](./LICENSE)
