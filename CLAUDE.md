# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

All project guidance (commands, architecture, SEO/AEO/GEO conventions, brand, testing, code style) lives in [AGENTS.md](./AGENTS.md), shared with other coding agents so it can't drift. It is imported here:

@AGENTS.md

## Working in this repo with Claude Code

- Read the relevant guide in `node_modules/next/dist/docs/` before using a Next.js API. This is Next 16, and its conventions differ from older training data.
- Before calling a change done, run `npm run lint`, `npm run typecheck` and `npm test`. For anything user-facing (pages, navigation, metadata, styling), also run `npm run test:e2e`, and stop any stale server on port 3100 first.
- Changing marketing copy, pricing, FAQs or product facts means editing `lib/marketing.ts`, `lib/pricing.ts` or `lib/site.ts`, never the JSX. The pages, JSON-LD and `llms.txt` all read from there.
- Changing the logo means editing `lib/brand.ts`, then running `npm run brand:assets`.
