---
status: done
spec: 022
blocked-by: —
---

# 051 — theSimulatorShowsAClearCacheButtonOnlyToCacheAdmins

> Client slice 3a of spec [022](022-cache-reset.SPEC.md) (POS Simulation stale-BBY cache reset).
> The server slices (`Pricing/ClearCache`, the `PricingCache` cache-admin grant, and the
> `GET Pricing/CacheAccess` probe) are **BackOffice** work — this ticket consumes the probe and is
> blocked on it being deployed to the dev API. No in-repo blocker.

## What to build

In the POS Simulation header (`SimulationPage.tsx`, the Actions block at ~line 241 — replacing the
`{/* … the desktop "Clear Cache" is dropped, spec 503 */}` note), a **Clear cache** button that
renders **only** for a holder of the new pricing cache-admin grant. A simulate-only analyst sees no
button; the button is show/hide hygiene, the server enforces the grant on the clear call regardless.

- `simulationApi.cacheAccess()` → `api.get('Pricing/CacheAccess')` returning `{ canClear: boolean }`
  (cookie-only probe, NOT grant-gated — the sibling of `Pricing/Access`). New model type in
  `@/core/models/simulation.ts`.
- The Page fetches it under its **own** TanStack Query key `['simulation','cacheAccess']` (distinct
  from `['simulation','access']` — different privilege) and gates the button on `canClear === true`.
- Button is wired but **inert this slice** (or a no-op onClick) — the confirm dialog + clear call +
  toasts land in [052](052-sim-clearcache-confirm-clear-toast.md). This slice proves the gating.
- i18n: new `clearCache.button` key in `simulation.json`. Logical Tailwind only; match the existing
  Process/Clear button styling in the Actions block.

## Spine reach

model/api (`cacheAccess()` + result type) · component (gated button render in `SimulationPage`) ·
i18n (`clearCache.button`) · test (drive: button present/absent by `canClear`).

## Proof (→ `tdd` red-green cycles)

- [x] `typecheck` + `build` green.
- [x] Drive (Chromium, SIS.Api mocked at the envelope like [013](013-web-sim-screen-tracer.md)):
      `CacheAccess → { canClear:true }` renders the Clear-cache button in the Actions block;
      `{ canClear:false }` renders no button; an absent/undefined `canClear` (failed or not-yet-
      deployed probe) also renders no button — the safe default. 3/3 checks passed via
      typecheck + drive (no client test tier — spec 503).

## Boundaries

- **New API dependency:** `GET Pricing/CacheAccess` — a BackOffice endpoint that does not exist yet
  (spec 022 slice 1). Until deployed, this slice is code-complete / runtime-blocked, mirroring the
  NC tickets' pattern. No `success:false` business codes on the probe itself (cookie-only read).
- New i18n key in the existing `simulation` namespace — no new namespace.
- oms-react repo only; no BackOffice change in this ticket.

## Done when

On `/pricing/simulation`, a cache-admin sees the Clear-cache button and a non-admin does not, driven
by `Pricing/CacheAccess`; typecheck + build green.

## Blocked by

None in-repo. Consumes BackOffice's `GET Pricing/CacheAccess` + the `PricingCache` cache-admin grant
(spec [022](022-cache-reset.SPEC.md) slice 1) — filed/tracked in `C:\Work\DMSCO\BackOffice\.issues\`.

## Open questions

- **CONTROLLER identity for the grant** (spec 022, Authorization §): proposed `PricingCache`
  (`COMMAND='03'`). A human/owner must confirm before the BackOffice seed SQL + probe are built,
  because the probe's grant check depends on it. Does not block the client's *shape* (the button
  gates on `canClear` regardless of the grant's internal identity), but the probe returns nothing
  useful until it's settled server-side.
