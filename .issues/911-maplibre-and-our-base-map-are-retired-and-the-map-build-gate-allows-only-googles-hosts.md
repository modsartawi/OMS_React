---
status: open
spec: BackOffice C:\Work\DMSCO\BackOffice\.issues\3630-the-map-chart-stores-as-points-on-a-map-spec.md
blocked-by: 908, 909, 910
---

# 911 — MapLibre and our base map are retired from the web app, and the map build gate allows only Google's hosts

## What to build

BackOffice spec 3630 M29, M30 and M36 as amended on 2026-11-17 (BackOffice ADR 0139): one engine only.

- **Removed:** `maplibre-gl`, `pmtiles` and `@protomaps/basemaps` from `package.json` and the lock file;
  `src/core/map/maplibre-engine.ts` and `map-style.ts`; everything under `public/map/` (the vendored Noto glyphs and
  their `OFL.txt`, the `grayscale` sprites, the RTL text-shaping add-on and its licence); the base-map dev server
  (`tools/basemap-dev-file.mjs`, its `.d.mts` and test, and the `basemapDevFile` plugin in `vite.config.ts`);
  `featuresAt`'s greedy grouping if 909 left it unused; the `BASEMAP_*` constants and `basemap-unreadable` reason.
- **The build gate (`tools/check-map-build.mjs`, `map-build-check.mjs`) is rewritten for Google:**
  1. As today, the app's entry and every analytics and copilot chunk reach no map code by static imports, and no
     Google script is named outside the map's own chunk.
  2. The map's chunks name **no outside host but Google's**: `MAP_ADDRESS_ALLOWED` becomes the named list of
     Google's hosts (the same as 910's drives and BackOffice 3987's proof), each with its reason. A MapLibre-only
     entry goes.
  3. **MapLibre, pmtiles and Protomaps are in no chunk.** The old "no chunk holds MapLibre" sanity check becomes "the
     map chunk holds the Google adapter".
  4. No key is in any built file: the gate fails on a string shaped like a Google API key (`AIza…`).
- **The README / dev notes** that tell a developer to put the base-map file in place go; in their place, how to set a
  development key and which origins it must allow.

## Proof (→ `tdd` red-green cycles)

Seam 7 of the spec.

- [ ] `map-build-check.test.mjs`: an outside host off Google's list fails the gate; each Google host on it passes; a MapLibre module in a chunk fails; a key-shaped string fails · oms-react tests
- [ ] Mutation check: a static `MapPanel` import in `AnalyticsBoardPage` and an `https://unpkg.com/...` in the adapter each turn the gate red
- [ ] `npm ls maplibre-gl pmtiles @protomaps/basemaps` finds nothing, `public/map/` is gone, and `vite` starts with no base-map middleware
- [ ] The built `dist/` holds no `pmtiles`, `maplibre` or `basemap` string · a search recorded under Comments

## Boundaries

Removal only, after 908 to 910 draw and print on Google. No behaviour of the panel changes. The base-map files in the
analytics release folder are BackOffice 3988's.

## Done when

Proof boxes ticked; `test`, `lint` and `build` are green (the known pre-existing `check-boundaries` findings aside).

## Blocked by

908, 909, 910 (nothing may still draw or print over MapLibre when it goes).
