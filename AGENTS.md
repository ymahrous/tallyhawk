# AGENTS.md

Guidance for AI coding agents working in this repository. This is the single source of truth: `CLAUDE.md` imports it, so update this file rather than duplicating guidance elsewhere.

## Project

The Next.js 16 (App Router, React 19, Tailwind v4) frontend for Tallyhawk, an AI receipt and invoice processing SaaS for freelancers. It is client-only — no server logic, no database — and talks to a separate FastAPI backend ([tallyhawk-backend](https://github.com/ymahrous/tallyhawk-backend)) over REST via `lib/api.ts`. Marketing pages are also built for search, answer and generative engines (see [SEO, AEO & GEO](#seo-aeo--geo)). `README.md` has the full feature list.

## Commands

```bash
npm run dev            # Dev server (localhost:3000); needs the backend (NEXT_PUBLIC_API_URL in .env.local)
npm run build          # Production build
npm run lint           # ESLint (eslint-config-next) — keep it at 0 errors and 0 warnings
npm run typecheck      # tsc --noEmit (strict)
npm test               # Vitest: unit, component and page-integration tests
npm run test:coverage  # Vitest + v8 coverage; fails below the thresholds in vitest.config.mts
npm run test:e2e       # Playwright + axe-core; builds into .next-e2e and serves on :3100
npm run brand:assets   # Regenerate favicons, app/PWA icons and logo files from lib/brand.ts

npx vitest run lib/api.test.ts             # One test file
npx vitest run -t "Conversion pending"     # Tests matching a name
npx playwright test e2e/seo.spec.ts        # One e2e spec
npx playwright test --project=desktop      # Skip the mobile-viewport project
```

Node ≥ 22.12 is required (Vitest 5, jsdom); CI runs Node 24. First-time e2e setup: `npx playwright install chromium`.

CI (`.github/workflows/ci.yml`) runs two jobs on every push and on PRs to `main`: **verify** (lint → typecheck → `test:coverage` → build) and **e2e** (`test:e2e`, report uploaded on failure). Husky + lint-staged run ESLint `--fix` and Prettier on staged files at commit time.

## Architecture

**API layer (`lib/api.ts`)** — the single point of contact with the backend. Every request other than login, signup and password reset goes through `authFetch`, which attaches the JWT from `localStorage` and treats a `401` or a client-side-expired token (`isTokenExpired()`, decoded via `decodeToken()`) as "Session expired", clearing the token. Pages call these functions directly rather than fetching inline. A few older pages (`vendors`, the account page's password and delete calls, `FeedbackButton`) still call `fetch` directly; prefer adding a function to `lib/api.ts` when touching them.

**Auth state has no context provider** — the JWT in `localStorage` *is* the source of truth. Protected pages call `isTokenExpired()` in a `useEffect` and `router.push("/login")`. `logout()` removes the token and dispatches a synthetic `storage` event, because real `storage` events only fire in *other* tabs. Components that only need "is someone signed in?" use `useIsLoggedIn()` (`lib/useIsLoggedIn.ts`, a `useSyncExternalStore` over that event). It returns `false` on the server, so server HTML and crawlers always see the signed-out CTAs.

**React contexts** (`app/providers/`), layered on top of auth, all readable synchronously on first render to avoid flicker:
- `PlanContext` — plan and usage. Seeds `plan` from the JWT (`decodeToken()`), then reconciles with `getUsage()` (and `getSubscription()` for Pro).
- `SettingsContext` — `base_currency` and plan. Seeds from the `tallyhawk_base_currency` cache, reconciles via `getSettings()`. `updateBaseCurrency()` updates optimistically, reverts to the *captured previous value* on failure, and dispatches `tallyhawk:currency-changed` (consumed by `useCurrencyChange()` and the dashboard) on success.
- `CookieConsentContext` — analytics consent. `AnalyticsGate` loads Vercel Analytics and Speed Insights only after "Accept".
- `ThemeContext` — an inline script (`themeScript`, injected in `app/layout.tsx`) sets `dark`/`light` on `<html>` before hydration; the provider adopts that class and keeps children `visibility: hidden` until it has.

**Dashboard polling (`app/app/page.tsx`)** — `getDocuments()` runs on a self-rescheduling `setTimeout` loop: 3s while any document is `PENDING`/`PROCESSING`, 30s once all are terminal. Each fetch aborts the previous one via `AbortController`. Each tick clears any pending timer before arming the next, and `pollNowRef` fetches immediately and re-arms. Uploads use it so a new document isn't stuck on the 30s idle interval. Completed documents' extractions are fetched once each (`getExtraction`) into an `extractions` map, de-duplicated with `fetchingIdsRef`.

**Currency (`lib/currency.ts`)** — `SUPPORTED_CURRENCIES` is the canonical ISO 4217 list behind the account selector and `formatCurrency()`/`formatDualCurrency()`. Every amount carries its own currency code from the API (original or converted). Never hardcode `"USD"` or assume an amount is in the account's current `base_currency`.

**Shared logic** — form rules live in `lib/validation.ts` (`validateEmail`, `validatePassword`, `getPasswordStrength`) and upload rules in `lib/uploads.ts` (`validateUploadFile`, limits and types). Reuse them; don't re-inline regexes or size limits in components.

### Rendering and styling

- **Marketing pages are Server Components**: `app/page.tsx`, `app/pricing/page.tsx` and `components/marketing/*`. They export `metadata`, render JSON-LD, and hydrate only small client islands (`AuthAwareCta`, `components/pricing/PricingPlans.tsx`). They style dark mode with Tailwind's **`dark:` variant** (`@custom-variant dark` in `globals.css`; the class is on `<html>` before paint).
- **Everything else is a Client Component** styled with `const isDark = useTheme().theme === "dark"` and `isDark ? "…" : "…"` ternaries next to the light classes. Because client pages can't export `metadata`, each route's metadata lives in a sibling `layout.tsx`.
- Don't mix the two conventions inside one component. `cn()` (`lib/utils.ts`) combines conditional classes.
- **Contrast**: muted text is `isDark ? "text-gray-400" : "text-gray-500"` (or `text-gray-500 dark:text-gray-400`). `gray-400` on light or `gray-500`/`gray-600` on black fails WCAG AA, and the e2e axe suite will flag it on public pages.
- Shared primitives: `components/ui/`; dashboard pieces: `components/dashboard/`; brand: `components/brand/Logo.tsx`.
- Navigation uses `next/link` `<Link>` (crawlable, middle-clickable). Reserve `router.push` for post-action redirects (logout, auth guards).

## SEO, AEO & GEO

All of it hangs off a few modules; keep facts in one place so pages, structured data and `llms.txt` can't contradict each other.

- **`lib/site.ts`** — `SITE_URL` (override with `NEXT_PUBLIC_SITE_URL`), titles and descriptions, `PRODUCT_FACTS` (derived from `lib/currency.ts` and `lib/uploads.ts`), `PUBLIC_ROUTES` (drives `sitemap.xml`, `llms.txt` and tests) and `PRIVATE_ROUTE_PREFIXES` (drives `robots.txt` disallows).
- **`lib/seo.ts`** — `pageMetadata()` for indexable pages and `privatePageMetadata()` for `noindex` ones. Next merges metadata **shallowly**: a segment that sets `openGraph` replaces the parent's object wholesale, including the file-based image. `pageMetadata()` therefore always emits the full canonical, Open Graph, Twitter and robots set. The root layout deliberately has **no** `alternates.canonical`, because every page would inherit it.
- **`lib/structured-data.ts` + `components/seo/JsonLd.tsx`** — schema.org builders linked by stable `@id`s. `JsonLd` escapes `<`. Rules: never add `aggregateRating`/`review` without real customer data; `FAQPage` markup must match the visible FAQ word for word; don't repeat a question across pages.
- **`lib/marketing.ts` / `lib/pricing.ts`** — all landing/pricing copy, FAQs, steps, features and plans. Every claim must be backed by the product code or the legal pages (`app/privacy`, `app/terms`). `lib/site.test.ts` enforces the numeric facts.
- **OG images** — each public route has an `opengraph-image.tsx` that calls `renderOgImage()` (`lib/og.tsx`, Satori, Inter from `assets/fonts/`). Satori limits: every multi-child `<div>` needs `display: "flex"`, and CSS `radial-gradient` is unreliable, so draw gradients in SVG. Twitter cards reuse the OG image automatically.
- **Crawlers** — `app/robots.ts` names AI search/assistant agents (`AI_SEARCH_AGENTS`) and training agents (`AI_TRAINING_AGENTS`, remove that list to opt out of training). Block `/app` as `/app$` + `/app/`, never a bare `/app`, which would also block `/apple-icon.png`. `app/llms.txt` and `app/llms-full.txt` are generated from the same constants (`lib/llms.ts`).

**Adding a public page:** add it to `PUBLIC_ROUTES`; give it `pageMetadata({ title, description, path })` (in `page.tsx` if it's a Server Component, else its `layout.tsx`) with a 70–170 character description; add an `opengraph-image.tsx`; render JSON-LD (`simplePageGraph()` at minimum); add it to `PAGES` in `e2e/a11y.spec.ts` and to the `PUBLIC` map in `app/route-metadata.test.tsx`.

**Adding a signed-in page:** `privatePageMetadata()` in its `layout.tsx`, an `isTokenExpired()` guard, its prefix in `PRIVATE_ROUTE_PREFIXES`, and no links to it from public pages (the footer is public).

## Brand

The mark, a geometric hawk head whose neck resolves into ledger rows, is defined once in `lib/brand.ts` (path data, gradient indigo `#6366F1` → emerald `#10B981`, ink `#07080F`). `LogoMark`/`Logo` render it inline with a per-instance gradient id; `renderOgImage()` embeds it. `npm run brand:assets` (`scripts/generate-brand-assets.mjs`, uses `sharp`) regenerates `app/icon.svg`, `app/favicon.ico`, `app/apple-icon.png`, `public/logo.{svg,png}` and `public/icons/*`. `lib/brand.test.ts` fails if they drift. Icons, manifest and robots use App Router file conventions: don't add `public/favicon.ico` or `public/robots.txt`, which conflict.

## Testing

**Vitest + React Testing Library (jsdom)**, colocated `*.test.ts(x)`:
- `vitest.setup.ts` globally mocks `next/navigation` (controlled via `test/navigation.ts`: `router`, `setPathname`, `setSearchParams`), `next/link` (plain `<a>`) and `next/image` (plain `<img>`), polyfills `matchMedia`/`ResizeObserver`, and clears `localStorage` and `<html>` classes after each test.
- Fake the backend at the `fetch` level with `mockApi()` from `test/api-mock.ts` (routes keyed `"METHOD /path"`; `accountRoutes()` covers what providers request on mount) so the real `lib/api.ts` runs. Tests call it as `http://api.test` (set in `vitest.config.mts`). Seed auth with `signIn()`/`makeToken()` from `test/auth.ts`.
- Render pages and provider-dependent components with `renderWithProviders()` (`test/render.tsx`). ThemeProvider adds a wrapper `<div>`, so use plain `render()` when asserting an empty container.
- Importing `app/layout.tsx` needs `next/font/google` mocked. Recharts' `ResponsiveContainer` needs a fixed size (see `app/app-pages.test.tsx`). jsdom doesn't implement navigation, so `location.reload()` and `location.href = …` only log "Not implemented".
- When a test exposes a bug, fix the code and keep the test as a regression test. Don't encode the bug in the assertion.

**Playwright** (`e2e/`, config in `playwright.config.ts`) runs against a production build in `.next-e2e` with `NEXT_PUBLIC_API_URL=http://api.tallyhawk.test`:
- The auto `api` fixture (`e2e/support/fixtures.ts`) intercepts that origin; any **unmocked request fails the test**. Use `api.set({...})` with static replies or stateful handlers. The `signIn()` fixture seeds a token once per tab. Cookie consent is pre-seeded unless `test.use({ seedConsent: false })`.
- Projects: `desktop` runs everything; `mobile` (Pixel 7) runs marketing, auth and dashboard. `e2e/a11y.spec.ts` runs axe WCAG 2.1 A/AA on every public page in both themes.
- Gotchas: Next's route announcer is also `role="alert"`, so filter alerts by text. After client-side navigation, wait for the new page's heading, not just the URL, before interacting. Locally `reuseExistingServer` reuses anything on :3100, so stop a stale server after changing app code. An e2e build makes Next add `.next-e2e` paths to `tsconfig.json` and repoint the gitignored `next-env.d.ts`; that's expected.

## Code style (from CONTRIBUTING.md)

- TypeScript strict: no `any` (use `unknown` and narrow); prefer `interface` for object shapes.
- Functional components only; split a component once it passes ~150 lines.
- Branch prefixes: `feat/`, `fix/`, `refactor/`, `docs/`, `perf/`, `chore/`.
- [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): description`, imperative mood, first line under 72 characters.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
