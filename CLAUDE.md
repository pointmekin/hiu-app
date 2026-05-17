# Project context — hiu-app

This is an internal admin tool replacing the Excel-based workflow for a ร้านหิ้ว (personal-shopper) business run by two people.

**Always read `docs/PLAN.md` before making architectural decisions or adding features. The plan is the contract.** If a request conflicts with the plan, flag it before coding.

---

## Stack

- TypeScript (strict)
- TanStack Start (SSR + server functions)
- Bun for install + scripts (not pnpm/npm)
- Drizzle ORM + drizzle-kit, Postgres on Neon
- better-auth with Drizzle adapter (email/password, cookie sessions)
- shadcn/ui + Tailwind
- TanStack Query v5, Zustand
- react-hook-form + zod, schemas shared between client and server
- i18next + react-i18next — Thai default, English alternative
- Cloudflare R2 for storage (via @aws-sdk/client-s3), sharp for image processing
- exceljs for XLSX exports
- Vitest + Playwright
- Biome for lint/format
- Deploy: Vercel

## Conventions

- Money: `numeric(12,2)` in DB, never `float`. Display via `Intl.NumberFormat`.
- Dates: store UTC, render `Asia/Bangkok`.
- Validation schemas (zod) live in `src/shared/schemas/` and are imported by both client forms and server functions. Never duplicate.
- Server functions group by domain under `src/server/functions/{domain}/`.
- Routes are file-based under `src/routes/`. Authenticated routes go under `_app/`.
- No client-side DB access. All DB work goes through server functions.
- Mutations write to `audit_log`. Use the audit helper, don't inline inserts.
- Optimistic updates on payment/cancel/line-edits. Roll back on error.
- All UI strings go through i18next. No string literals in JSX except dev placeholders.
- Translation keys mirror file structure: `orders.list.empty`, `payments.record.title`.
- The `order_draft` Zustand store persists to localStorage. Don't break that contract.

## What NOT to do

- Don't add LINE/Instagram chat integration — explicitly out of scope.
- Don't add customer-facing pages or routes.
- Don't introduce a search service (Meilisearch, Elastic, etc.). Postgres pg_trgm + tsvector is the answer.
- Don't change the Kerry export header row without running the golden-file test.
- Don't translate user-entered data (product names, customer names, etc.) — only UI chrome.
- Don't suggest "let me run the dev server" — propose changes, run typecheck and tests, but defer running long-lived processes.

## Open questions (still need answers from Chom)

1. Per-user logins or shared? Default assumption: per-user.
2. Buddhist or Gregorian calendar for Thai dates? Default: Gregorian.
3. Mid-round FX rate change — recompute non-overridden round_products only, freeze order_items? Default: yes.
4. Kerry template file — still need the real one before M4.
5. Thai font preference — Plex Sans Thai Looped vs Sarabun vs Noto Sans Thai.

Update this list when answered.

## Workflow

- Branch per milestone: `m1-skeleton`, `m2-catalog`, etc.
- Small commits with conventional commit prefixes (`feat:`, `fix:`, `chore:`, `refactor:`).
- Run `bun run typecheck` and `bun run test` before any commit.
- Update `docs/PLAN.md` when scope or decisions change. Don't let it drift.

## Current milestone

M1 — Skeleton. See `docs/PLAN.md` §16.

## Useful commands

```bash
bun install
bun run dev               # local dev
bun run typecheck
bun run lint
bun run test
bun drizzle-kit generate  # after schema changes
bun drizzle-kit migrate
bun run scripts/create-user.ts --email x --name "X" --role admin
```