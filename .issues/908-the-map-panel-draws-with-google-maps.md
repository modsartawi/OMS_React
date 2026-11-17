---
status: done
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

- [x] Given points, the panel hands the engine those points, the key from the model, region `SA`, the screen's language, and a view fitted to them · oms-react tests (`map-panel.test.ts`)
- [x] No `maps` part, or an empty key: the panel says "cannot draw" (`no-key`) without loading Google's script · oms-react tests
- [x] Google's auth failure and a loader that fails or times out each end as "cannot draw" with their reason, once · oms-react tests (stand-in loader)
- [x] "Drawn" is signalled once, after tiles loaded and idle with the points on · oms-react tests
- [x] The loader's URL carries the key, `region=SA`, `language`, a pinned `v=`, and nothing else of ours · oms-react tests
- [x] The board, report and copilot chunks load no map code and no Google script until a map is on screen · the build gate (`check-map-build`), Google's hosts added to its allow-list with their reason
- [x] A board map drawn in English and in Arabic on the local stack with a real key: Google's road map, KSA borders, "Arabian Gulf" / "الخليج العربي", Arabic labels on an Arabic screen · seen by a person, screenshots under `.issues/assets/`

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

## Comments

**2026-11-17 — built** (branch `spec/3630-908`, off `spec/3630-google-build`). Status stays **open**: the last proof box
is a person's look.

Design:

- **The port** (`src/core/map/map-panel.ts`): `MapEngineStart` dropped `style` and `rtlTextPlugin` and gained `key`,
  `mapId?`, `region: 'SA'` (`MAP_REGION`) and `plainPoint` (908's one size and colour: `POINT_RADIUS.plain`,
  `--chart-1`, ring `--map-ring`); `lang` and `controlsCorner` stay. `MapEngineEvents` dropped `painted` and
  `basemapUnreadable` and gained `tilesLoaded()`, `idle()` and `failed('refused' | 'unreachable' | 'no-graphics')`.
  `featuresAt`, `pointer`, `tap`, `moved`, `sized` and `graphicsLost` stay for 909.
- **The panel's endings** (`openMapPanel`): no key (no `maps` part, empty or blank) → `cannot-draw: no-key` at once,
  the engine never started, so Google's script is never asked for. "Drawn" once Google has reported both
  `tilesloaded` and `idle` (either order), once. `failed(reason)` → `cannot-draw: <reason>`, once; a refusal after
  "drawn" ends it again as `cannot-draw: refused` (Google greys a refused map out), the same rule as review W9's lost
  graphics. `CannotDrawReason` = `no-key | refused | unreachable | no-graphics`; `basemap-unreadable` is gone from it.
- **The loader** (`google-loader.ts`, our own, no new package): one `<script>` per page, added on the first map's
  start: `https://maps.googleapis.com/maps/api/js?key=…&v=3.66&region=SA&language=en|ar&loading=async&callback=…`.
  `gm_authFailure` is listened for before the tag is added and told to every map (and at once to one opened after
  it) → `refused`. The script's `onerror`, or no callback within 15 s (`GOOGLE_LOAD_TIMEOUT_MS`, inside the print
  page's 20), → `unreachable`. Both are kept for the page's life: no second tag.
- **The adapter** (`google-engine.ts`, not unit-tested, as the ticket says): `importLibrary('maps')` and `('marker')`,
  then `new Map` with `renderingType: RASTER`, `mapTypeId: 'roadmap'`, `disableDefaultUI`, zoom control at
  `TOP_RIGHT` (LTR) / `TOP_LEFT` (RTL), no street view, map type, full-screen, rotate or camera control,
  `clickableIcons: false`, the served `mapId` when there is one. A box is fitted with 40 px padding and no closer than
  zoom 15; one point is centred at zoom 13. Points are put on the map before Google can report anything, so
  `tilesloaded` + `idle` means "with the points on". `new Map` throwing → `no-graphics`; `importLibrary` failing →
  `unreachable`.
- **The key reaches the panel from the model**: `AnalyticsModel.maps?: { key, mapId? }` (`readModel`: no part when
  the key is missing, empty or not text; `mapId` only when non-empty), `MapBody` passes `maps={model.maps}` to
  `LazyMapPanel` (a new optional prop; the others unchanged), and `copilotTableModel` keeps the reader's `maps` part
  for the copilot's map. The print page reads `Render/Model` through the same `readModel`, so it carries the part
  too. Wire names as BackOffice 3986's ticket (`maps`, `key`, `mapId`).
- **"© OpenStreetMap"** and `MAP_CREDIT` are gone from the panel (M34 amended): Google draws its own logo and terms.
- **MapLibre is left in place for 911**, unused by the panel: `maplibre-engine.ts` builds its own style and calls
  the new events; `isBasemapUnreadable`/`isPainted` and their tests moved to `map-style.ts` / `map-style.test.ts`.
- **The build gate** (minimal, 911 rewrites it): `https://maps.googleapis.com/maps/api/js` is on
  `MAP_ADDRESS_ALLOWED` with its reason (an allowed address still allows only itself); `google-engine` and
  `google-loader` are map code for the leak check; the "the check would scan nothing" sanity check now looks for the
  Google adapter instead of MapLibre. `check-map-build: ok — 3 map chunk(s) loaded only on demand`.

Tests (vitest): `google-loader.test.ts` (15: the address, once per page, error, time-out, late answer, auth failure to
every map and to a late one), `map-panel.test.ts` (30), `MapPanel.test.ts` (4: no credit of ours, nothing hidden from
print, the key not in the markup), `map-chart.test.ts` (+3: `readModel`'s `maps`), `copilot-table.test.ts` (+2),
`map-build-check.test.mjs` (+3). Mutation checks: dropping the loader's once-per-page memo turns 3 loader tests red;
"drawn" on tiles OR idle turns the either-alone test red. `npm test` 803 files / 11,048 tests green; `typecheck`
green; `build` green; lint gates green but `check-boundaries`' 4 known insurance-rules findings.

Local check with the owner's real key (never written to a tracked file; the drive is in the session scratchpad, not
the repo): the copilot map drive against `vite` on `localhost:5209`, with the model stub carrying `maps.key`, Google's
hosts let through and every other outside host aborted. **English and Arabic both `drawn`**, Google's logo and terms
on the map, 0 other outside requests, 0 console errors; Google hosts reached: `maps.googleapis.com`,
`maps.gstatic.com`, `fonts.googleapis.com`, `fonts.gstatic.com` (for 910 and 911's list). The key's referrers allow
`localhost`. Screenshots `.issues/assets/908-copilot-map-{en,ar}.png` (central Riyadh: Arabic place names on the Arabic
screen). Not yet looked at: a board map, the Gulf's name — the last box stays open.

Open questions, answered:

- **Marker kind:** 908 draws classic `google.maps.Marker`s with a circle symbol (deprecated, not removed), which need no
  map ID, so the map stays raster with no map ID at all. A served `maps.mapId` is passed to the map (its own
  rendering setting then rules). 909 chooses the marker for sized, coloured and grouped points.
- **Language switch:** the shell has no live language switch (`@/core/i18n` boots `en`); the print pages set theirs
  before any map is on screen. Google's script is loaded once per page in the first map's language, so a map shown
  after a language change keeps that language until the page is reloaded.
- **Development key:** the owner's key drew on `http://localhost:5209`, so its referrers allow localhost; no separate
  development key was needed for this check.
- **The version pin:** `v=3.66`. On 2026-11-17 Google answered `quarterly` = 3.65.14a, `weekly` = 3.66.13d, `3.67` =
  3.67.1b, and a retired `3.62` with its weekly (3.66.13d), not an error, so the pin is moved forward on purpose.

For 909: the adapter does not yet wire pointer, tap or move events (the points are not clickable), so the card and a
group's click wait for 909; the legend shows 881's sizes and colours above plain points until then.

**2026-11-17 — seen by the owner.** The owner looked at the Google map today on the local stack, in English and
in Arabic: Google's road map with the KSA borders, "Arabian Gulf" / "الخليج العربي", and Arabic labels on the Arabic
screen (screenshots `.issues/assets/908-copilot-map-{en,ar}.png`). The last Proof box is ticked; the ticket is closed.
