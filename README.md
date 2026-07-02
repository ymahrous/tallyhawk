<div align="center">

# edocAI — [![CI/CD](https://github.com/ymahrous/edocai/actions/workflows/ci.yml/badge.svg)](https://github.com/ymahrous/edocai/actions/workflows/ci.yml)

**The web client for edocAI, an asynchronous AI-powered document processing platform.**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38BDF8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-edocai.vercel.app-0070F3?logo=vercel&logoColor=white)](https://edocai.vercel.app)

</div>

---

## Overview

This is the Next.js frontend for edocAI, a SaaS-style web application where users upload invoices and receipts and receive structured JSON extractions back, processed asynchronously by a separate backend API.

This repository contains the client only. It talks to the [edocAI backend](https://github.com/ymahrous/edocai-backend) (FastAPI + Celery + Google Gemini) over a REST API and renders no AI logic itself.

---

## Features

- **Email/password authentication** with JWT bearer tokens, including password strength validation, rate-limited login attempts, and a confirm-password flow on signup
- **Document dashboard** with drag-and-drop upload, live polling for processing status, and rendered JSON extraction results
- **Account page** for viewing session info and changing password
- **Dark/light theme** with system preference detection and cross-tab sync
- **Responsive navigation** with a mobile menu and active-route highlighting
- **Legal pages** (Terms of Service, Privacy Policy) written for the actual infrastructure this app runs on
- **SEO-ready**: per-route metadata, sitemap, robots.txt, Open Graph tags

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS v4 |
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
│   ├── page.tsx                 # Landing page
│   ├── layout.tsx               # Root layout, fonts, metadata, theme script
│   ├── globals.css              # Tailwind v4 theme config
│   ├── sitemap.ts               # Dynamic sitemap generation
│   ├── not-found.tsx            # Custom 404
│   ├── app/
│   │   ├── page.tsx             # Authenticated dashboard
│   │   ├── layout.tsx           # Route metadata
│   │   ├── loading.tsx          # Skeleton loading state
│   │   └── error.tsx            # Error boundary
│   ├── login/
│   │   ├── page.tsx
│   │   └── layout.tsx
│   ├── signup/
│   │   ├── page.tsx
│   │   └── layout.tsx
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
│       └── ThemeContext.tsx     # Dark/light theme provider
├── components/
│   └── ui/
│       ├── Navbar.tsx
│       ├── Footer.tsx
│       ├── AuthCard.tsx         # Shared login/signup card shell
│       ├── PasswordToggle.tsx   # Shared show/hide password button
│       └── ...                  # shadcn/ui primitives
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

**Styling philosophy** — All components are styled directly with Tailwind utility classes and a small set of shared primitives (`AuthCard`, `PasswordToggle`) rather than a heavy design system, keeping the bundle lean for a project this size.

---

## Related Repositories

- [edocai-backend](https://github.com/ymahrous/edocai-backend) — FastAPI + Celery + Google Gemini backend

---

## License

[MIT](./LICENSE)
