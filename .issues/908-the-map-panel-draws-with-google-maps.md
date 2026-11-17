---
status: open
spec: BackOffice C:\Work\DMSCO\BackOffice\.issues\3630-the-map-chart-stores-as-points-on-a-map-spec.md
blocked-by: BackOffice 3986
---

# 908 — The map panel draws with Google Maps: the key from the server, region Saudi Arabia, the screen's language, loaded only when a map is shown

## What to build

BackOffice spec 3630 M28, M29, M33 to M35 as amended on 2026-11-17; BackOffice ADR 0139 (Google Maps everywhere,
superseding ADR 0135). The map panel of 879 keeps its door and its contract; only the engine under it changes.

- **A Google engine behind the same port.** `src/core/map/map-panel.ts` keeps the engine as a port
  (`MapEngine.start(start, events)`); a new adapter, `google-engine.ts`, draws with the Google Maps JavaScript API in
  place of `maplibre-engine.ts`. The port drops what was MapLibre's alone (`style`, `rtlTextPlugin`, the base-map
  source) and gains what Google needs (`key`, `mapId?`, `lang`, `region: 'SA'`).
- **The door is unchanged for its callers.** `LazyMapPanel` keeps its props (`points`, `grouping`, `ariaLabel`,
  `onDrawn`, `onCannotDraw`, `className`), and the panel's frame keeps `data-map-state` = `drawing` / `drawn` /
  `cannot-draw`. Board panels, report blocks, the print page and the copilot answer do not change.
- **The key comes from the server.** The analytics model's `maps` part (BackOffice 3986: `{ key, mapId? }`), read
  from the model the caller already holds; under a render ticket, from the ticket's model. Never in the code, the
  build or `.env` files. No `maps` part, or an empty key → "cannot draw" (reason `no-key`), and the caller shows the
  table.
- **Google's loader, once per page,** fetched only when the first map is on screen: `maps.googleapis.com` with the
  key, `region=SA`, `language=ar|en` from the screen, and the version pinned (`v=` a named release, not `weekly`).
  Through Google's own loader package (`@googlemaps/js-api-loader`, exact version) or a small loader of our own;
  either way one script tag per page.
- **Google's standard road map.** No restyle. No street view, no map-type switch, no full-screen control; zoom
  buttons at the reading end, as today. Google's logo and terms stay as Google draws them, on screen and in print.
- **Plain points, fitted.** Given points, it draws them as plain points of one size and one colour (881's sizes,
  colours, groups and card come back with 909) and opens fitted to them, a single point centred at zoom 13 as today.
- **"Drawn"** = Google reports its tiles loaded (`tilesloaded`) and the map is `idle` with the points on it. Exactly
  one ending, as today.
- **"Cannot draw"** with a reason: `no-key`; `refused` (Google's `gm_authFailure`: the key or the referrer refused,
  the API not enabled, billing off); `unreachable` (the loader's script failed or did not arrive in time, the quota
  spent); `no-graphics` (the engine could not start). `basemap-unreadable` goes.
- **Rendered without WebGL where Google allows it** (`renderingType: RASTER`), so a headless print needs no graphics
  card. If markers drawn as HTML need a map ID (see Open questions), the map ID's own rendering setting is raster.

## Proof (→ `tdd` red-green cycles)

Seams 6 and 7 of the spec. The engine is replaced by a stand-in in the panel tests, as today; the Google adapter is
not unit-tested against Google's internals.

- [ ] Given points, the panel hands the engine those points, the key from the model, region `SA`, the screen's language, and a view fitted to them · oms-react tests (`map-panel.test.ts`)
- [ ] No `maps` part, or an empty key: the panel says "cannot draw" (`no-key`) without loading Google's script · oms-react tests
- [ ] Google's auth failure and a loader that fails or times out each end as "cannot draw" with their reason, once · oms-react tests (stand-in loader)
- [ ] "Drawn" is signalled once, after tiles loaded and idle with the points on · oms-react tests
- [ ] The loader's URL carries the key, `region=SA`, `language`, a pinned `v=`, and nothing else of ours · oms-react tests
- [ ] The board, report and copilot chunks load no map code and no Google script until a map is on screen · the build gate (`check-map-build`), Google's hosts added to its allow-list with their reason
- [ ] A board map drawn in English and in Arabic on the local stack with a real key: Google's road map, KSA borders, "Arabian Gulf" / "الخليج العربي", Arabic labels on an Arabic screen · seen by a person, screenshots under `.issues/assets/`

## Boundaries

Behind the server's `Analytics:MapChart`, as before. The MapLibre engine, its style, the vendored assets and the
base-map dev server are removed by 911, not here, so the two can be compared until then. No key in git: a real key
is set only in the developer's local server settings. Each map drawn is a billed map load; the drives use stubs
where they can.

## Done when

Proof boxes ticked; `test`, `lint` and `build` are green (the known pre-existing `check-boundaries` findings aside).

## Blocked by

BackOffice 3986 (the model's `maps` part).

## Open questions

- **Markers as HTML need a map ID.** Google's `AdvancedMarkerElement` (the current marker, and what 909 needs for
  sized, coloured, hollow points and group labels) works only on a map with a map ID. Default: a map ID made by IT in
  the key's Google project, raster, with Google's default style, served as `maps.mapId`; Google's `DEMO_MAP_ID` in
  development only. If no map ID can be had, the fallback is the older `google.maps.Marker` with a circle symbol,
  which Google has deprecated but not removed. Record the choice here.
- **Changing the screen's language with a map on screen.** Google's script is loaded once per page with one
  language. Default: the next page load draws in the new language; record what the app does today on a language
  switch (a reload or not).
- **A separate development key.** The location-link key's referrers are unlikely to allow `localhost`. Default: ask
  IT to add the dev origins, or a development key restricted to `localhost`.
