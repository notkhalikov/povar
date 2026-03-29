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
| `apps/api` | `DATABASE_URL`, `JWT_SECRET`, `BOT_TOKEN` (for initData validation) |
| `apps/bot` | `BOT_TOKEN`, `API_BASE_URL` |
| `apps/web` | proxied via Vite to `localhost:3000` |
| `apps/admin` | proxied via Vite to `localhost:3000` |
