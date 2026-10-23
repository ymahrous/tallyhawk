# AGENTS.md

Guidance for AI coding agents working in this repository. This is the single source of truth: `CLAUDE.md` imports it, so update this file rather than duplicating guidance elsewhere.

## Project

Tallyhawk, an AI receipt and invoice processing SaaS for freelancers, as one Next.js 16 app (App Router, React 19, Tailwind v4): the UI **and** its REST API. The API lives in Route Handlers under `app/api/v1` backed by server-only modules in `server/` (Postgres via Drizzle, Gemini, Stripe, QuickBooks, Supabase Storage, Resend). It replaced a separate FastAPI + Celery backend and keeps its URLs, JSON shapes and database tables unchanged. The UI talks to it via `lib/api.ts`. Marketing pages are also built for search, answer and generative engines (see [SEO, AEO & GEO](#seo-aeo--geo)). `README.md` has the full feature list.

## Commands

```bash
npm run dev            # Dev server (localhost:3000); UI + API. Needs .env.local (see .env.example)
npm run db:migrate     # Apply server/db/migrations/*.sql to DATABASE_URL (idempotent)
npm run build          # Production build
npm run lint           # ESLint (eslint-config-next) — keep it at 0 errors and 0 warnings
npm run typecheck      # tsc --noEmit (strict)
npm test               # Vitest: unit, component and page-integration tests
npm run test:coverage  # Vitest + v8 coverage; fails below the thresholds in vitest.config.mts
npm run test:e2e       # Playwright + axe-core; builds into .next-e2e and serves on :3100
npm run brand:assets   # Regenerate favicons, app/PWA icons and logo files from lib/brand.ts

npx vitest run lib/api.test.ts             # One test file
npx vitest run app/api server              # Only the API/server tests
npx vitest run -t "Conversion pending"     # Tests matching a name
npx playwright test e2e/seo.spec.ts        # One e2e spec
npx playwright test --project=desktop      # Skip the mobile-viewport project
```

Node ≥ 22.12 is required (Vitest 5, jsdom); CI runs Node 24. First-time e2e setup: `npx playwright install chromium`.

CI (`.github/workflows/ci.yml`) runs two jobs on every push and on PRs to `main`: **verify** (lint → typecheck → `test:coverage` → build) and **e2e** (`test:e2e`, report uploaded on failure). Husky + lint-staged run ESLint `--fix` and Prettier on staged files at commit time.

## Architecture

**API client (`lib/api.ts`)** — the single point of contact with the API. `API_URL` defaults to the same-origin `/api/v1`; `NEXT_PUBLIC_API_URL` overrides it (the unit and e2e suites point it at a fake `.test` origin). Every request other than login, signup and password reset goes through `authFetch`, which attaches the JWT from `localStorage` and treats a `401` or a client-side-expired token (`isTokenExpired()`, decoded via `decodeToken()`) as "Session expired", clearing the token. Pages call these functions directly rather than fetching inline. A few older pages (`vendors`, the account page's password and delete calls, `FeedbackButton`) still call `fetch` directly with the exported `API_URL`; prefer adding a function to `lib/api.ts` when touching them. Endpoints have no trailing slash (`/documents`, not `/documents/`).

**Auth state has no context provider** — the JWT in `localStorage` *is* the source of truth. Protected pages call `isTokenExpired()` in a `useEffect` and `router.push("/login")`. `logout()` removes the token and dispatches a synthetic `storage` event, because real `storage` events only fire in *other* tabs. Components that only need "is someone signed in?" use `useIsLoggedIn()` (`lib/useIsLoggedIn.ts`, a `useSyncExternalStore` over that event). It returns `false` on the server, so server HTML and crawlers always see the signed-out CTAs.

**React contexts** (`app/providers/`), layered on top of auth, all readable synchronously on first render to avoid flicker:
- `PlanContext` — plan and usage. Seeds `plan` from the JWT (`decodeToken()`), then reconciles with `getUsage()` (and `getSubscription()` for Pro).
- `SettingsContext` — `base_currency` and plan. Seeds from the `tallyhawk_base_currency` cache, reconciles via `getSettings()`. `updateBaseCurrency()` updates optimistically, reverts to the *captured previous value* on failure, and dispatches `tallyhawk:currency-changed` (consumed by `useCurrencyChange()` and the dashboard) on success.
- `CookieConsentContext` — analytics consent. `AnalyticsGate` loads Vercel Analytics and Speed Insights only after "Accept".
- `ThemeContext` — an inline script (`themeScript`, injected in `app/layout.tsx`) sets `dark`/`light` on `<html>` before hydration; the provider adopts that class and keeps children `visibility: hidden` until it has.

**Dashboard polling (`app/app/page.tsx`)** — `getDocuments()` runs on a self-rescheduling `setTimeout` loop: 3s while any document is `PENDING`/`PROCESSING`, 30s once all are terminal. Each fetch aborts the previous one via `AbortController`. Each tick clears any pending timer before arming the next, and `pollNowRef` fetches immediately and re-arms. Uploads use it so a new document isn't stuck on the 30s idle interval. Completed documents' extractions are fetched once each (`getExtraction`) into an `extractions` map, de-duplicated with `fetchingIdsRef`.

**Currency (`lib/currency.ts`)** — `SUPPORTED_CURRENCIES` is the canonical ISO 4217 list behind the account selector and `formatCurrency()`/`formatDualCurrency()`. Every amount carries its own currency code from the API (original or converted). Never hardcode `"USD"` or assume an amount is in the account's current `base_currency`.

**Shared logic** — form rules live in `lib/validation.ts` (`validateEmail`, `validatePassword`, `getPasswordStrength`) and upload rules in `lib/uploads.ts` (`validateUploadFile`, limits and types). Reuse them; don't re-inline regexes or size limits in components.

### Server (`app/api/v1` + `server/`)

Route handlers are thin: each `route.ts` wraps its handler in `route()` (`server/http.ts`), which turns a thrown `ApiError(status, detail)` into FastAPI-style `{ "detail": … }` JSON and anything else into a logged 500. Bodies are validated with zod via `parseJson()` (422 with a `[{loc, msg, type}]` list); integer query params with `intQuery()`. Route files may only export HTTP methods and segment config (`maxDuration` etc.), so shared code goes in `server/`. Every `server/*` module starts with `import "server-only"`. Dynamic segments are typed with `Params<"documentId">` from `server/http.ts`, not the generated `RouteContext`, so `tsc` works before `next build`.

- **Auth** — `getCurrentUser(request)` (Bearer HS256 JWT signed with `SECRET_KEY`, `sub` = username) and `getCurrentAdmin(request)` (requires `role: "admin"`). Passwords are bcrypt (`bcryptjs`, compatible with the old Python hashes). Tokens: 24h for users (`sub`, `plan`), 12h for the admin. There's no admin signup: the admin is one manually-seeded `user` row whose username is `ADMIN_USERNAME`; `POST /admin/login` only accepts that account. QuickBooks OAuth `state` is a 15-minute JWT with `role: "qb_oauth"`, which `getCurrentUser` refuses.
- **Data scoping** — there's no row-level security. Every query on `document`/`extraction`/`vendor` must filter by the authenticated user (`documents.ownerId`, `vendors.userId`) explicitly, including lookups by id.
- **Database (`server/db/`)** — `schema.ts` mirrors, column for column, the tables SQLModel created (`"user"`, `document`, `extraction`, `vendor`, `subscription`, `usagerecord`, `quickbooksconnection`, `feedback`, `passwordresettoken`). Most NOT NULL columns have no DB default, so defaults are `$defaultFn` in JS. Timestamps are `timestamp without time zone` holding UTC (except `user.created_at`, `timestamptz`). `getDb()` connects lazily on first use (builds need no `DATABASE_URL`). Schema changes = a new idempotent `migrations/NNNN_*.sql` + the matching `schema.ts` edit. The test harness applies the same SQL.
- **Upload pipeline** — `POST /upload` stores the file in Supabase, inserts a `PENDING` document, counts usage and schedules `processDocument()` (`server/pipeline.ts`) with `runInBackground()` (`server/background.ts`, Next's `after()`; this replaced Celery). The pipeline: `PROCESSING` → Gemini 2.5 Flash extraction (`server/ai.ts`; PDFs are sent natively, no rasterising) → currency conversion → vendor match (`server/vendors.ts`, a faithful port of Python `difflib.get_close_matches`, cutoff 0.8; fuzzy hits become aliases) → `COMPLETED` → duplicate/price-anomaly flags (`server/detection.ts`, comma-joined in `document.flags`). Any exception marks the document `FAILED`. The upload route's `maxDuration = 60` bounds the background work on Vercel.
- **Free tier** — 10 documents a month (`FREE_TIER_LIMIT`, `server/usage.ts`), counted in `usagerecord` keyed by the first of the UTC month. The ledger is never decremented, so deleting documents doesn't refund quota and the dashboard's lifetime "processed" count is stable.

**Multi-currency invariants (don't break these):**
- Extraction stores the original (`original_amount`, `original_currency`) **and** the converted (`converted_amount`, `converted_currency`, `exchange_rate`). `converted_currency` is the base currency *at conversion time*.
- `convertCurrency()` returns `rate: null` when no real conversion happened (no `EXCHANGE_RATE_API_KEY`, API failure), as opposed to `1` for same-currency. On `null`, leave the converted fields `null`. Never write a fabricated 1.0 rate: it's indistinguishable from a real 1:1 conversion and has corrupted production data before.
- Changing `base_currency` (`PATCH /auth/settings`) re-converts every completed extraction with a known original in the background (`reconvertUserCurrency()`, one rate lookup per original currency, re-reading the currency at run time). Legacy rows without an original are left alone.
- Anything that **aggregates or compares** amounts across rows uses `reliableAmount()` (`server/amounts.ts`): only `converted_amount` whose `converted_currency` equals the user's *current* base currency counts. Others are excluded (dashboard reports how many as `excluded_from_month_spend`; the tax CSV lists them separately), never blended in.

**Known limitations (documented trade-offs, don't "fix" silently):**
- No retry if Gemini fails; the document is `FAILED`. If the process dies mid-extraction, a document can stay `PROCESSING`.
- Storage paths are the uploaded filename (upsert), shared across users, exactly as before: same-named uploads overwrite each other's file, and deleting one deletes the shared object.
- `DELETE /documents/{id}` deletes rows, then the file, with no recovery if the file delete fails.
- Amount parsing strips everything but digits, `.` and `-` (so `"€1.000,00"` parses as `1`), matching the original worker.

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

**API tests** (`app/api/v1/**/*.test.ts`, `server/*.test.ts`) start with `// @vitest-environment node` and use `test/server.ts`: `createTestDb()` (PGlite, an in-process WASM Postgres, with the real migration applied) once per file, `resetTestDb()` before each test, fixtures `createUser()`/`createDocument()`, `call(handler, method, path, { token, body, params })` to invoke a route handler like Next does, and `stubFetch()` for outbound HTTP. Mock `@/server/background` with `backgroundMock` and `await flushBackground()` to run `after()` work. Mock the SDK wrappers (`@/server/ai`, `storage`, `email`, `stripe`) per file; they're excluded from coverage. `vitest.config.mts` sets `SECRET_KEY` and `BCRYPT_ROUNDS=4` and aliases `server-only` to its empty module.

**Playwright** (`e2e/`, config in `playwright.config.ts`) runs against a production build in `.next-e2e` with `NEXT_PUBLIC_API_URL=http://api.tallyhawk.test`, so the browser never reaches the real `/api/v1`:
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
