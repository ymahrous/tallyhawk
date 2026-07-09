<div align="center">

# edocAI

**The web client for edocAI, an AI-powered financial document processing platform.**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38BDF8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-edocai.vercel.app-0070F3?logo=vercel&logoColor=white)](https://edocai.vercel.app)

</div>

---

## Overview

This is the Next.js frontend for edocAI, a SaaS platform where solo founders and freelancers upload invoices and receipts to extract structured data, categorize spend, and sync directly to QuickBooks Online.

This repository contains the client only. It talks to the [edocAI backend](https://github.com/ymahrous/edocai-backend) (FastAPI + Celery + Google Gemini) over a REST API and renders no AI logic itself.

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

### Account & Billing
- **Stripe Subscriptions** — free tier (10 docs/month) and Pro tier with checkout sessions and billing portal
- **Email/password authentication** with JWT bearer tokens, password strength validation, rate-limited login attempts, and a confirm-password flow
- **Forgot/Reset Password** — secure, expiring token flow with HTML emails via Resend
- **Account page** for viewing session info, changing password, managing QuickBooks connection, and exporting tax summaries

### UX & Design
- **Dark/light theme** with system preference detection, cross-tab sync, and no flash on load
- **Responsive navigation** with a mobile menu, user avatar dropdown, and active-route highlighting
- **Global Feedback Widget** — expanding chat-bubble UI for suggestions, bug reports, or general feedback
- **Legal pages** (Terms of Service, Privacy Policy) written for the actual infrastructure this app runs on
- **SEO-ready**: per-route metadata, sitemap, robots.txt, Open Graph tags

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
| Git hooks | Husky + lint-staged |
| CI | GitHub Actions |
| Hosting | Vercel |

---

## Project Structure

```
edocai/
├── app/
│   ├── page.tsx                 # Landing page with live UI mockup
│   ├── layout.tsx               # Root layout, fonts, metadata, theme script
│   ├── globals.css              # Tailwind v4 theme config
│   ├── sitemap.ts               # Dynamic sitemap generation
│   ├── not-found.tsx            # Custom 404
│   ├── analytics/
│   │   └── page.tsx             # Spend analytics dashboard (Pro)
│   ├── app/
│   │   ├── page.tsx             # Authenticated dashboard
│   │   ├── layout.tsx           # Route metadata
│   │   ├── loading.tsx          # Skeleton loading state
│   │   └── error.tsx            # Error boundary
│   ├── vendors/
│   │   └── page.tsx             # Vendor intelligence UI
│   ├── login/
│   │   ├── page.tsx
│   │   └── layout.tsx
│   ├── signup/
│   │   ├── page.tsx
│   │   └── layout.tsx
│   ├── forgot-password/
│   │   └── page.tsx
│   ├── reset-password/
│   │   └── page.tsx
│   ├── pricing/
│   │   └── page.tsx
│   ├── capture/
│   │   └── page.tsx             # PWA mobile capture
│   ├── account/
│   │   ├── page.tsx             # Account settings
│   │   └── layout.tsx
│   ├── privacy/
│   │   ├── page.tsx
│   │   └── layout.tsx
│   ├── terms/
│   │   ├── page.tsx
│   │   └── layout.tsx
│   └── providers/
│       ├── ThemeContext.tsx      # Dark/light theme provider
│       └── PlanContext.tsx      # Global subscription state
├── components/
│   ├── dashboard/
│   │   ├── DocumentCard.tsx     # Document row with extraction preview & image modal
│   │   ├── UploadZone.tsx
│   │   └── Alerts.tsx
│   ├── ui/
│   │   ├── Navbar.tsx
│   │   ├── Footer.tsx
│   │   ├── FeedbackButton.tsx   # Global feedback widget
│   │   ├── UsageMeter.tsx
│   │   ├── SyncButton.tsx       # QuickBooks sync status/action
│   │   ├── CategoryPage.tsx
│   │   ├── ExpandingImagePreview.tsx # Shared layout animation for image previews
│   │   ├── PasswordToggle.tsx   # Shared show/hide password button
│   │   └── ...                  # shadcn/ui primitives
├── lib/
│   ├── api.ts                   # Backend API client
│   └── utils.ts                 # cn() helper
├── public/
│   ├── logo.svg
│   ├── favicon.svg
│   └── robots.txt
├── .github/workflows/ci.yml     # Lint, type-check, build
├── .husky/pre-commit
├── .lintstagedrc.json
├── .prettierrc
└── eslint.config.mjs
```

---

## Local Development

### Prerequisites

- Node.js 20+
- A running instance of the [edocAI backend](https://github.com/ymahrous/edocai-backend), locally or deployed

### Setup

```bash
git clone https://github.com/ymahrous/edocai.git
cd edocai
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
npm run dev      # Start the dev server
npm run build    # Production build
npm run start    # Start the production server
npm run lint     # Run ESLint
```

---

## Git Hooks

This repo uses Husky and lint-staged. On every commit:

- Staged `.ts`/`.tsx` files are linted with ESLint (`--fix`)
- Staged `.ts`, `.tsx`, `.json`, `.css`, `.md` files are formatted with Prettier

No setup needed — hooks are installed automatically via `npm install` (`prepare` script).

---

## Continuous Integration

Every push and pull request to `main` runs:

1. `npm run lint`
2. `npx tsc --noEmit`
3. `npm run build`

See `.github/workflows/ci.yml`. The build step requires a `NEXT_PUBLIC_API_URL` repository secret pointing to a reachable backend URL.

---

## Deployment

Deployed to [Vercel](https://vercel.com). Connect the repository, set `NEXT_PUBLIC_API_URL` to the deployed backend's URL, and deploy — no additional configuration required.

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | ✅ | Base URL of the edocAI backend API |

---

## Design Notes

**Theming** — An inline script in `app/layout.tsx` runs before React hydrates, reading `localStorage` and `prefers-color-scheme` to set the theme class on `<html>` immediately. This avoids a flash of the wrong theme on load. Theme changes are synced across browser tabs using the native `storage` event.

**Auth state** — JWT is stored in `localStorage`. Components that need to react to login/logout state (Navbar, landing page CTA) listen for `storage` events, which `logout()` dispatches manually to support same-tab updates.

**Vendor Normalization** — The raw vendor string from the AI is stored in `extracted_data` for auditing, but the UI and analytics always prefer the normalized `vendor.canonical_name` via a SQLModel relationship. This means renaming or merging a vendor instantly updates all historical documents and charts without mutating historical JSON blobs.

**Styling philosophy** — All components are styled directly with Tailwind utility classes and a small set of shared primitives (`PasswordToggle`, `UsageMeter`, `SyncButton`) rather than a heavy design system, keeping the bundle lean for a project this size.

---

## Related Repositories

- [edocai-backend](https://github.com/ymahrous/edocai-backend) — FastAPI + Celery + Google Gemini backend

---

## License

[MIT](./LICENSE)