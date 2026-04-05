# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Telegram Mini App + Telegram Bot marketplace for home cooks in Tbilisi and Batumi (Georgia). Users discover and order home-cooked meals directly via Telegram.

**Before working on any feature — read the relevant file in `docs/` first.**

## Monorepo Structure

npm workspaces. Each app lives in `apps/`:

| App | Stack | Port |
|-----|-------|------|
| `apps/api` | Fastify + TypeScript + PostgreSQL | 3000 |
| `apps/bot` | grammY + TypeScript | — |
| `apps/web` | React + Vite + @twa-dev/sdk | 5173 |
| `apps/admin` | React + Vite | 5174 |

Shared TypeScript base config: `tsconfig.base.json`.

## Commands

```bash
# Install all workspaces
npm install

# Run individual apps
npm run dev:api
npm run dev:bot
npm run dev:web
npm run dev:admin

# Build / lint / typecheck all
npm run build
npm run lint
npm run typecheck

# Run a single workspace command directly
npm run dev --workspace=apps/api
```

Each app also supports `npm run dev` / `build` / `typecheck` / `lint` run from its own directory.

## Architecture Notes

- **Auth:** users are identified via Telegram `initData` (sent by the Mini App). The API validates the HMAC signature of `initData` using `BOT_TOKEN`. Never trust `initDataUnsafe` server-side without validation.
- **Bot ↔ API:** the bot calls `apps/api` over HTTP (`API_BASE_URL`). No direct DB access from the bot.
- **Admin:** separate React app hitting `/api/admin/*` endpoints protected by admin JWT.
- **Geography:** Tbilisi and Batumi only — city is a required filter on cooks and orders.

## Environment Variables

Copy `.env.example` → `.env` in each app before starting.

| App | Key variables |
|-----|---------------|
| `apps/api` | `DATABASE_URL`, `JWT_SECRET` (≥32 chars), `BOT_TOKEN`, `WEBHOOK_SECRET`, `ADMIN_TELEGRAM_ID` |
| `apps/bot` | `BOT_TOKEN`, `API_BASE_URL`, `MINI_APP_URL`, `WEBHOOK_SECRET` |
| `apps/web` | proxied via Vite to `localhost:3000` |
| `apps/admin` | proxied via Vite to `localhost:3000` |

## Current Status

### Implemented (ready for launch)

1. **Auth** — Telegram initData HMAC validation, JWT session, UTM tracking
2. **Chef profiles** — CRUD, cuisine tags, work formats, districts, avg price, portfolio photos
3. **Chef onboarding flow** — multi-step form in Mini App, role assignment
4. **Chef verification** — document + selfie upload, admin review queue, Telegram notifications on decision
5. **Catalog** — paginated chef list (20/page), filters by city/format/cuisine, infinite scroll, pull-to-refresh
6. **Chef page** — hero, portfolio gallery, bio, badges (verified/top/new), reviews with chef reply
7. **Orders** — create, status machine (draft→awaiting_payment→paid→in_progress→completed), timeline UI
8. **Payments** — Telegram Stars invoice via `sendInvoice`, webhook to mark order paid
9. **Reviews** — star rating, quality tags, text, chef reply, report button
10. **Disputes** — open dispute, reason codes, support review flow, resolution types
11. **Requests** — customer posts open request, chefs respond with price + comment, customer accepts
12. **i18n** — Russian + English, auto-detected from Telegram language, typed translation objects
13. **Onboarding** — 3-slide onboarding for first-time users, swipe navigation, localStorage gate
14. **UX polish** — page slide animations, Telegram BackButton, pull-to-refresh, infinite scroll, haptic feedback, Telegram MainButton CTAs, ChefCard tap animation, skeleton shimmer
15. **Security** — CORS locked to production domain, dev routes behind NODE_ENV guard, rate limiting (60 req/min), Sentry error tracking, client-error sink
16. **Deployment** — `vercel.json` SPA rewrite for `apps/web`, Railway for API + bot

### Planned (post-launch)

- **Fiat payments** — GEL via Stripe or local payment provider (currently Telegram Stars only)
- **Promo codes & referral program** — discount codes, referral tracking via UTM + start_param
- **Automatic refunds** — programmatic refund on dispute resolution
- **S3/R2 media storage** — replace Telegram file_id with durable object storage for verification docs and portfolio
- **Admin panel** — full React admin UI for user/order/dispute management (currently bot-only)
- **Push notifications** — in-app badge updates without opening the app

### Known limitations

See [docs/known-issues.md](docs/known-issues.md) for the full list.
