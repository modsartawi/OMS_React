---
status: done
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

- [x] `map-build-check.test.mjs`: an outside host off Google's list fails the gate; each Google host on it passes; a MapLibre module in a chunk fails; a key-shaped string fails · oms-react tests
- [x] Mutation check: a static `MapPanel` import in `AnalyticsBoardPage` and an `https://unpkg.com/...` in the adapter each turn the gate red
- [x] `npm ls maplibre-gl pmtiles @protomaps/basemaps` finds nothing, `public/map/` is gone, and `vite` starts with no base-map middleware
- [x] The built `dist/` holds no `pmtiles`, `maplibre` or `basemap` string · a search recorded under Comments

## Boundaries

Removal only, after 908 to 910 draw and print on Google. No behaviour of the panel changes. The base-map files in the
analytics release folder are BackOffice 3988's.

## Done when

Proof boxes ticked; `test`, `lint` and `build` are green (the known pre-existing `check-boundaries` findings aside).

## Blocked by

908, 909, 910 (nothing may still draw or print over MapLibre when it goes).

## Comments

**2026-11-17 — built and done** (branch `spec/3630-911`, off `spec/3630-google-build` at 910's `7cfabbce`).

Removed:

- **Packages** `maplibre-gl` 5.6.0, `pmtiles` 4.3.0, `@protomaps/basemaps` 5.7.0 (40 packages out of the lock file,
  ~40 MB of `node_modules`: maplibre-gl 39 MB, pmtiles 380 KB, basemaps 470 KB). `npm ls maplibre-gl pmtiles
  @protomaps/basemaps` → `(empty)`.
- **`public/map/`** whole: 775 files, 12 MB (the Noto glyph ranges and `OFL.txt`, the `grayscale` sprites, the RTL
  text-shaping add-on and its licence) — no longer copied into every `dist/`. `public/` holds only `favicon.svg`.
- **Code** `src/core/map/maplibre-engine.ts`, `map-style.ts` and `map-style.test.ts` (with them `BASEMAP_PATH`,
  `BASEMAP_SOURCE`, `GLYPHS_PATH`, `RTL_TEXT_PLUGIN_PATH`, `isBasemapUnreadable`, `isPainted`; `basemap-unreadable`
  had already left `CannotDrawReason` in 908).
- **The base-map dev server** `tools/basemap-dev-file.mjs`, `.d.mts`, `.test.mjs` and the `basemapDevFile` plugin in
  `vite.config.ts` (with it `OMS_BASEMAP_FILE`). `vite` now answers `/basemap/ksa-bh.pmtiles` with the SPA's
  `index.html` (200 text/html): no middleware.
- **Kept:** `featuresAt` — 909 made it the one grouping Google draws (`map-panel.ts`, `google-engine.ts`), so it is
  used and stays, with `groupSum`, `groupRadius`, `pointRadius`, `openingZoom`, `cardAfter`.

The gate (`tools/check-map-build.mjs` over `tools/map-build-check.mjs`), rewritten:

1. Unchanged: the entry, every analytics and copilot chunk reach no map code (`MapPanel`, `google-engine`,
   `google-loader`) by static imports. New: no chunk but the map's names Google's map **script** hosts
   (`maps.googleapis.com`, `maps.gstatic.com`) — `googleNamedOutsideMap`. The font hosts are left out of that one
   check on purpose: AG Grid's theme font loader names `fonts.googleapis.com` in the grid's own chunk, and is no map.
2. `MAP_ADDRESS_ALLOWED` is now Google's **hosts**, built from `GOOGLE_MAP_HOSTS` (`tools/google-map-hosts.mjs`, the
   drives' one list), each with its reason (a host with no reason throws). Matched exactly (case folded, port
   ignored): a sub-domain, a look-alike (`maps.googleapis.com.evil.example`) or another Google host (`www.google.com`)
   fails. Every MapLibre/OSM/W3C entry went; nothing else was needed — the map's three chunks name no other host.
3. `retiredEngineIn`: MapLibre, pmtiles or Protomaps in any chunk fails; and the map's chunks must hold
   `google-engine.ts`, or the scan would scan nothing.
4. `keyShapedStrings` (`AIza` + 30 or more of `[0-9A-Za-z_-]`) over **every** built output (chunks, CSS, assets) and
   every file under `public/` (copied as is): any hit fails, printing only its first 6 characters.

Output: `check-map-build: ok — 3 map chunk(s) loaded only on demand, naming no host but Google's; no retired engine;
no key in 541 built file(s)`.

Tests: `tools/map-build-check.test.mjs` rewritten, 22 (red first: 11 red on the old module, then 1 red for the AG Grid
font stylesheet found on the real build, then green). Mutation checks on the real gate (planted, gate run, restored
by copy):

| planted | gate |
| --- | --- |
| a static `import MapPanel` in `AnalyticsBoardPage.tsx` | red: `AnalyticsBoardPage-….js -> MapPanel-….js (google-loader, google-engine, MapPanel)` |
| `"https://unpkg.com/@googlemaps/js-api-loader@1.16.8/dist/index.min.js"` in `google-engine.ts` | red: `MapPanel-….js: names https://unpkg.com/…` |
| a key-shaped `"AIzaSy…"` in `google-engine.ts` | red: `MapPanel-….js: holds a key-shaped string AIzaSy…` |
| the loader's script on `maps.example.com` | red: `MapPanel-….js: names https://maps.example.com/maps/api/js` |

(An unused planted export is tree-shaken out and never reaches a chunk, so each plant is used at module level.)

`dist/` after `npm run build`: 11 MB; `grep -rliE 'pmtiles|maplibre|basemap' dist` → 0 files; `grep -rl AIza dist` →
0 files.

Gates: `npm test` 803 files / 11,071 tests green (the 4 `map-style` tests and 3 `basemap-dev-file` tests left with
their modules); `typecheck` green; `build` green; `check-grid-base`, `check-contrast`, `check-palette`,
`check-controls`, `check-map-build` green; `check-boundaries` only its 4 known insurance-rules findings.

README: a "The map chart's Google key" section in place of base-map notes (there were none in the README; the dev
notes lived in `basemap-dev-file.mjs` and `vite.config.ts`, both gone): the key is SIS.Api's `Analytics:GoogleMapsKey`
(BackOffice 3986), never in the repo or build; a development key's HTTP referrers must allow `http://localhost:*`
with the Maps JavaScript API on; deployed keys allow the OMS web host and the render host; the drives take
`GOOGLE_MAPS_KEY`.

Last draw check, with the owner's real key from the environment (never in a file here; the staged diff holds 0 hits of
its first 10 characters): `copilot-map-drive` against `vite` on `localhost:5208` — `copilot-map-drive: ok`, English
and Arabic drawn on Google `3.66.13d` with groups and points, logo and terms, 0 outside requests, 0 console errors,
Google hosts the four of the list. Screenshots `.issues/assets/911-copilot-map-{en,ar}.png`. Dev server stopped.
