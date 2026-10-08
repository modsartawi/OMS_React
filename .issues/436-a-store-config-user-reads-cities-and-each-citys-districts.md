---
status: done
spec: 430
blocked-by: 431
---

# 436 — A store-config user reads cities and each city's districts

## What to build

This is the read side of *Cities & districts* (spec 430 D6, D13).

- **Leaf and route.** The "Cities & districts" leaf is gated on `canOpenGeography`. The route is
  `/oms/geography`, with a page guard.
- **Cities grid (upper).** It loads `GET SdDocumentWeb/Cities` on open and shows code, English
  name, Arabic name, and last change (by and on).
- **Districts grid (lower).** Selecting a city loads `GET SdDocumentWeb/Districts?cityCode=` and
  lists its districts: code, English and Arabic names, Magento city EN/AR, store, insurance store,
  temporary store, latitude/longitude, and last change.
- **Each grid** has a text filter (quick filter) and an xlsx export.
- **Models.** `SdCityModel` and `SdDistrictModel` go in `@/core/models`.
- **Bidi.** Arabic and English names are free text (`<bdi>`), and codes and coordinates are machine
  values.

## Spine reach

model/api · logic (selection → districts query) · component/route/menu · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `districtsQuery` — no query until a city is selected, keyed by city code · pure
- [x] `tools/geography-drive.mjs` — cities on open, select → districts, quick filter, export, the leaf hidden without the flag, RTL · flow

## Boundaries

- New gated read doors (BO-5, not filed), built on a stub. The cookie-open `SdDocument/Cities` and
  `SdDocument/Districts` are **not** used.
- A new namespace, `geography`.
- No import (437).

## Done when

The drive is green on the stub, and the gates are green.

## Blocked by

[431](431-an-hq-lead-lists-todays-donor-requests-across-stores-and-filters-them.md) (for the probe flags)

## Comments

**Done 2026-10-08 (AFK).** This was built on a STUB of spec 430 D2/D6. The gated reads
`GET SdDocumentWeb/Cities` and `GET SdDocumentWeb/Districts?cityCode=` (BO-5, not filed) are NOT
built, so nothing was driven against a live SIS.Api.

- **Proof:**
  - vitest `geography/geography.test.ts` (8 tests):
    - `districtsQuery` asks nothing until a city is selected (`enabled: false`)
    - it is keyed by the city code (`['geography','districts',code]`), under the same root as `citiesQuery`
    - `selectedCityCode` trims, and a blank code selects no city
    - `lastChange` takes the update, falls back to the creation when the update is unset, and blank when neither is set
  - `access.test.ts` and `menu-model.test.ts` gained `canOpenGeography`: it reads only its own flag (the import flags alone do not show it), and the leaf follows Document payments (D18).
  - Full suite: 219 files, 4032 tests green.
  - Drive `tools/geography-drive.mjs`: 76/76 in LTR and RTL (stubbed). It checks:
    - the leaf is hidden without the flag, the URL shows the denied card, and no cities call is made
    - the leaf position (D18), and ONE probe call for the group and the gate
    - cities load on open, once, and no district is read before a selection
    - the column sets, isolation and the last-change fallback
    - select → that city's districts, titled with `code · name` isolated whole; another city, and an empty city
    - each quick filter by code, English name, Arabic name or store; the filtered count; "nothing matches"; another city clears the districts filter
    - both xlsx exports, as shown (filtered rows, coordinates numeric, no isolates)
    - a refused cities load and a failed districts load, each with its own message
    - no page errors
  - `npm run typecheck`, `npm run lint` (all four gates) and `npm run build` are green.
- **Outstanding (not AFK's):**
  - a live walk on a real SIS.Api once BO-5 ships
  - the owner's eye on the Arabic rendering
- **Decisions** are logged in `.afk/HITL-436.md`:
  - `SdCityModel` sits beside the existing `SdDistrictModel` in `@/core/models/lookups.ts`
  - "last change" = the update, else the creation
  - grid cells are isolated by the core grid base, not `Ltr`
