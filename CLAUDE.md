# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

GearBnB customer website (gearbnbrental.com): camping gear rental (packages and Build Your Own), checkout with verification and deposits, a read-only shop of gear for sale, and the Find A Campsite directory (Coming Soon until launch). The admin backend ("RMS", a separate Next.js app maintained separately) owns inventory, bookings, promos, the shop and campsites; this site reads and writes through its customer API (`src/utils/rmsApi.ts`) and uses Supabase for auth, storage uploads and the package catalog.

## Commands

- `npm run dev` — Vite dev server. In dev, RMS calls go to `VITE_RMS_DEV_API_URL` (default `http://localhost:3000`), never production (see the comment at the top of `src/utils/rmsApi.ts`).
- `npm test` — Vitest (`vitest run`). Tests sit next to their code (`*.test.ts`, `*.render.test.tsx` render with `react-dom/server`).
- `npm run lint` — Oxlint (not ESLint).
- `npm run build` — `tsc -b`, then the Vite build, then pre-rendering (below).
- `npm run preview` — preview the production build locally.

Type-check without building: `npx tsc --noEmit -p tsconfig.app.json`

Environment: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (public anon key only, never the service role key), `VITE_RMS_API_URL`; optional `VITE_ORS_KEY`, `VITE_MAPTILER_KEY`. `VITE_CAMPSITE_SAMPLES=1` swaps in made-up campsites for local work only; never build an upload with it.

## Architecture

**Stack:** React 19 + TypeScript + Vite + Tailwind CSS v4 + react-router 7.

Tailwind is wired in via the `@tailwindcss/vite` plugin (see `vite.config.ts`), not a `tailwind.config.js` + PostCSS setup — v4 is CSS-first, so the only Tailwind entry point is `@import "tailwindcss";` at the top of `src/index.css`. Colours are theme tokens defined there (`ink`, `surface`, `line`, `accent`, `brand-forest`, …).

**TypeScript config gotchas** (`tsconfig.app.json`):
- `verbatimModuleSyntax: true` — type-only imports must use `import type { X } from '...'`, or the build fails.
- `noUnusedLocals` / `noUnusedParameters: true` — unused variables/params are build errors, not warnings.

**Routing:** `src/App.tsx` (routes are code-split with `lazyWithRetry`). Product addresses open their details over the list: `/catalog/camping-packages/:slug`, `/catalog/build-your-own/:slug`, `/catalog/camping-gear-sale/:slug`.

**State (React contexts, no external store):**
- `AuthContext` — Supabase auth, sign-in, password reset.
- `CatalogContext` (`useCatalog`) — package and gear catalog (Supabase + RMS).
- `RentalContext` (`useRental`) — the cart and booking flow; its pricing helpers (`calculateRentalDurationDays`, `calculateDueToday`, `calculateSecurityDeposit`, …) are exported as pure functions for tests. Deposit tiers live in `src/utils/securityDeposit.ts`.
- `PromoContext` — the live RMS promo.
- `ShopData` / `CampsiteData` — only used to hand data to the pre-renderer.

Domain types: `src/types/gearbnb.ts` (rental), `src/types/campsite.ts` (the campsite API contract, kept identical to the RMS handoff in `~/gearbnb-handoffs/find-a-campsite-rms.md`).

**Pre-rendering and the server** (`vite.config.ts` → `prerenderRouteMeta`, `src/prerender.tsx`): every public page, and one page per package, gear kind and shop listing, gets its own HTML in `dist/_pages` with title, description, canonical, Open Graph and JSON-LD; plus a Markdown copy in `dist/_md`, `sitemap.xml` and `llms.txt` (`src/agentFiles.ts`). The build rewrites `dist/.htaccess` (Hostinger/Apache) so only known addresses are answered; everything else is a real 404. Page titles and descriptions live in `src/config/pageMeta.ts`; every new route must be listed there (`PRERENDERED_PAGES` or `CLIENT_ONLY_PATHS`), which `src/appRoutes.test.ts` checks. A failed catalog/shop fetch at build time never fails the build; it leaves those pages out with a warning.

**Shop** (`/catalog/camping-gear-sale`, `src/utils/shop.ts`, `src/config/shopMeta.ts`): read-only, everything from RMS `GET /api/customer/shop` (no hard-coded items). Listings use the RMS `listingKey`/`quantity`. Addresses are the listing name, plus a key fragment only when names collide; `resolveShopSlug` sends out-of-date addresses to the current one, and the build turns `shopRedirectRules` into 301s. Buying is via Messenger for now; checkout comes later.

**Find A Campsite** (`/campsites`): built but hidden behind `LAUNCHED = false` in `src/config/features.ts` (every campsite address shows a Coming Soon page and nothing is indexed). A dev server with `VITE_CAMPSITE_SAMPLES=1` shows the real pages. The map is MapLibre with free OpenFreeMap data (`src/components/campsites/mapStyle.ts`).

**Customer-facing copy:** no em dashes.
