# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

GearBNB customer-facing frontend: a camping gear rental web app. This repo is the customer portal only (browsing, cart, checkout, verification). A separate admin backend ("RMS") is being built independently by someone else — there is no backend integration yet, and all state below is client-only.

## Commands

- `npm run dev` — start the Vite dev server
- `npm run build` — type-check (`tsc -b`) then production build via Vite
- `npm run lint` — run Oxlint (not ESLint)
- `npm run preview` — preview the production build locally

There is no test runner configured in this repo yet (no test script, no Vitest/Jest dependency).

To type-check without building: `npx tsc --noEmit -p tsconfig.app.json`

## Architecture

**Stack:** React 19 + TypeScript + Vite + Tailwind CSS v4.

Tailwind is wired in via the `@tailwindcss/vite` plugin (see `vite.config.ts`), not a `tailwind.config.js` + PostCSS setup — v4 is CSS-first, so the only Tailwind entry point is `@import "tailwindcss";` at the top of `src/index.css`.

**TypeScript config gotchas** (`tsconfig.app.json`):
- `verbatimModuleSyntax: true` — type-only imports must use `import type { X } from '...'`, or the build fails.
- `noUnusedLocals` / `noUnusedParameters: true` — unused variables/params are build errors, not warnings.

**State management:** `src/context/RentalContext.tsx` is the single source of truth for the booking/cart flow. It's a `useReducer`-backed React Context (no external state library) exposing a `useRental()` hook. Everything reads/writes through this context — there is no other state store.

**Domain types:** `src/types/gearbnb.ts` defines the full data model (`PackageKit`, `IndividualItem`, `TripDetails`, `VerificationDocs`, `CartState`). `RentalContext` is built directly on top of these types; changes to the booking data shape should start there.

**Core business rules** (encoded in `RentalContext`):
- **Path A (Packages)** — `PackageKit`s are added/removed as single, indivisible units via `addKit`/`removeKit` (no duplicates, no partial quantities).
- **Path B (Build Your Own)** — `IndividualItem`s are added/removed independently via `addItem`/`removeItem`, fully decoupled from kit state.
- **Split payment** — the context computes two totals off `cart`, exposed as `totals` on the context value:
  - `dueToday` = sum of `depositAmount` across selected kits + items (security deposit, duration-independent).
  - `dueBeforeStart` = sum of kit `packagePrice` (flat) + `dailyRate × rentalDurationDays` per item. `rentalDurationDays` is derived from `TripDetails.startDate`/`returnDate` (see `calculateRentalDurationDays`).
  - These three calculations are exported as standalone pure functions from `RentalContext.tsx` so they're testable independent of the provider.

**Checkout components** (`src/components/checkout/`):
- `VerificationUpload.tsx` — contact info + the 4 required verification documents (2 government IDs, selfie with ID, proof of billing), reads/writes `verificationDocs` on the context. File uploads are local-only for now: selecting a file creates an `URL.createObjectURL()` preview and stores that blob URL string in `VerificationDocs` (no real upload/backend yet — that string will need to become a real uploaded file URL/ID once RMS integration exists).
- `PaymentBreakdown.tsx` — renders the two split-payment summary cards plus an itemized breakdown. Note: it applies a local flat `DELIVERY_FEE` placeholder constant on top of `totals.dueBeforeStart` when `fulfillmentType === 'delivery'` — this fee does not live in `RentalContext` or the type model, since real fulfillment pricing hasn't been defined by the business/RMS side yet.

**No routing library yet.** `src/App.tsx` is still the default Vite template scaffold; checkout components aren't wired into it. When adding pages/routes, that decision hasn't been made yet.
