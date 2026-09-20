# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project

This is the Next.js 16 (App Router) frontend for Tallyhawk, an AI-powered financial document processing SaaS. It is a client-only repo — no server logic, no database — that talks to a separate FastAPI backend ([Tallyhawk backend](https://github.com/ymahrous/tallyhawk-backend)) purely over REST via `lib/api.ts`. See `README.md` for the full feature list.

## Commands

```bash
npm run dev        # Start dev server (localhost:3000)
npm run build      # Production build
npm run start      # Start production server
npm run lint       # ESLint (eslint-config-next)
npm run typecheck  # tsc --noEmit (strict mode)
npm test           # Vitest, single run
npm run test:watch # Vitest, watch mode
npx vitest run lib/currency.test.ts   # Single test file
npx vitest run -t "Conversion pending" # Single test by name
```

Tests are Vitest + React Testing Library in a jsdom environment, colocated with the code as `*.test.ts(x)`. Config lives in `vitest.config.mts`; `vitest.setup.ts` wires up jest-dom matchers and RTL cleanup. Vitest 5 and jsdom require Node ≥22.12 — CI runs Node 24. Components whose children hit the network (e.g. `SyncButton`, `CategoryPage` inside `DocumentCard`) are `vi.mock`ed in tests.

CI (`.github/workflows/ci.yml`) runs lint → typecheck → test → build on every push and on PRs to `main`. Husky + lint-staged run ESLint (`--fix`) and Prettier on staged `.ts`/`.tsx` (and Prettier on `.json`/`.css`/`.md`) at commit time — no manual setup needed after `npm install`.

Requires a running instance of the backend (`NEXT_PUBLIC_API_URL` in `.env.local`, copied from `.env.example`) for any page that calls `lib/api.ts`.

## Architecture

**API layer (`lib/api.ts`)** — the single point of contact with the backend. Every request other than login/signup goes through `authFetch`, which attaches the JWT bearer token from `localStorage` and treats a `401` or a client-side-expired token (`isTokenExpired()`, decoded via `decodeToken()`) as "Session expired". Route components generally call these functions directly rather than fetching inline.

**Auth state has no context provider** — the JWT in `localStorage` *is* the source of truth. `isTokenExpired()` gates route access (called in a `useEffect` on each protected page, redirecting to `/login`). `logout()` removes the token and manually dispatches a `storage` event so same-tab listeners (Navbar, PlanContext, SettingsContext) update immediately — `storage` events don't fire in the tab that made the change, only other tabs, hence the manual dispatch.

**Two React contexts layered on top of auth**, both in `app/providers/`, both syncing off the same `storage` event and both readable synchronously on first render to avoid flicker:
- `PlanContext` — plan/usage/subscription data. Seeds its initial `plan` synchronously from the JWT payload (`decodeToken()`) before the backend responds, then calls `refreshPlan()` (`getUsage` + `getSubscription`) to reconcile.
- `SettingsContext` — `base_currency` and plan. Seeds synchronously from a `localStorage` cache (`tallyhawk_base_currency`), then reconciles via `getSettings()`. `updateBaseCurrency()` optimistically updates local state before the PATCH resolves and reverts on failure. Dispatches a custom `tallyhawk:currency-changed` event on success (consumed by `useCurrencyChange()`) since currency changes need to propagate within the same tab too, unlike auth state.

`ThemeContext` follows the same "avoid flash" pattern via a different mechanism: an inline script (`themeScript` in `app/providers/ThemeContext.tsx`, injected in `app/layout.tsx`) sets the `dark`/`light` class on `<html>` before React hydrates; the provider then reads that already-applied class on mount rather than recomputing it, and keeps children `visibility: hidden` until it has.

**Dashboard polling (`app/app/page.tsx`)** is the most complex data-flow in the app: `getDocuments()` is polled on a self-adjusting `setTimeout` loop (not `setInterval`) using a backoff ref — 3s while any document is `PENDING`/`PROCESSING`, 30s once all are terminal (`COMPLETED`/`FAILED`). Each poll aborts the previous in-flight request via `AbortController`. Once a document reaches `COMPLETED`, its extraction is fetched separately (`getExtraction`) and cached in an `extractions` map keyed by document id, deduped via a `fetchingIdsRef` set so the same id isn't double-fetched across renders.

**Currency formatting (`lib/currency.ts`)** — `SUPPORTED_CURRENCIES` is the canonical ISO 4217 list (with symbol/region) backing both the account-page currency selector and `formatCurrency()`/`formatDualCurrency()`. Every amount displayed in the UI carries its own currency code from the API response (original or converted) — components must not hardcode `"USD"` or assume an amount is in the account's current `base_currency`.

**Styling** — Tailwind utility classes directly on elements, no heavy component/theming abstraction. Dark mode is handled manually per-component via `isDark ? "..." : "..."` ternaries co-located with the light classes (there is no `dark:` variant convention in use), driven by `useTheme()`. `cn()` (`lib/utils.ts`) is used when conditionally combining classes. Shared UI primitives live in `components/ui/`; dashboard-specific pieces live in `components/dashboard/`.

## Code style (from CONTRIBUTING.md)

- TypeScript strict mode: no `any` (use `unknown` and narrow explicitly); prefer `interface` over `type` for object shapes.
- Functional components only; split a component once it exceeds ~150 lines.
- Branch prefixes: `feat/`, `fix/`, `refactor/`, `docs/`, `perf/`, `chore/`.
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/) (`type(scope): description`, imperative mood, first line under 72 chars).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
