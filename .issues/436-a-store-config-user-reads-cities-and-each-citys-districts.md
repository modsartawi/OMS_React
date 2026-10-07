---
status: open
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

- [ ] `districtsQuery` — no query until a city is selected, keyed by city code · pure
- [ ] `tools/geography-drive.mjs` — cities on open, select → districts, quick filter, export, the leaf hidden without the flag, RTL · flow

## Boundaries

- New gated read doors (BO-5, not filed), built on a stub. The cookie-open `SdDocument/Cities` and
  `SdDocument/Districts` are **not** used.
- A new namespace, `geography`.
- No import (437).

## Done when

The drive is green on the stub, and the gates are green.

## Blocked by

[431](431-an-hq-lead-lists-todays-donor-requests-across-stores-and-filters-them.md) (for the probe flags)
