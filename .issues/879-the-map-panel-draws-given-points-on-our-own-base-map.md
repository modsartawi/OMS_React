---
status: done
spec: BackOffice C:\Work\DMSCO\BackOffice\.issues\3630-the-map-chart-stores-as-points-on-a-map-spec.md
blocked-by: BackOffice 3634
---

# 879 — The map panel draws given points on our own base map, in Arabic or English, loads only when shown, and names no outside address

## What to build

BackOffice spec 3630, M28, M29 and M33 to M35; BackOffice ADR 0135. The foundation every later map ticket draws
on: a map panel component that, given a list of points, draws them on a map of KSA and Bahrain.

- **The engine is MapLibre,** over the one base-map file of BackOffice 3634, read by byte range from one fixed
  path on our own site.
- **Nothing is fetched from another host.** The library, the style, the fonts for Latin and Arabic labels, the
  icons and the Arabic text-shaping add-on are all served from our own site. Versions are pinned exactly.
- **One style,** the quiet grey base of the prototype, so the points carry the colour. Light only.
- **Place names follow the screen's language:** Arabic names on an Arabic screen, shaped and joined correctly,
  English otherwise. The panel's own controls follow the screen's direction.
- **The credit line** "© OpenStreetMap" is on every map, small, and stays when the page is printed. If BackOffice
  3634 recorded a second credit its licence requires, it is shown too.
- **Given points, it draws them** as plain points of one size and one colour, and opens fitted to them. Size,
  colour, groups and the card come with 881.
- **It says when it is drawn:** a signal after the base map and the points are painted. The print page waits on it
  (883).
- **It says when it cannot draw** (no graphics support, or the base-map file cannot be read), so the caller can
  show the table.
- **Loaded only when a map is on screen.** A board, a report or a panel answer with no map loads none of the
  map's code or files.
- **A proof page,** in development builds only: the panel with 20 fixed store points. BackOffice 3635 prints it
  through the report renderer. 883 removes it.

## Proof (→ `tdd` red-green cycles)

Seams 6 and 7 of the spec. The map engine is replaced by a stand-in in the component tests; they do not assert on
the library's internals or on pixels.

- [x] Given points, the panel hands the engine those points and a view fitted to them · oms-react tests
- [x] On an Arabic screen the style asks for Arabic names and the add-on is loaded from our own site · oms-react tests
- [x] The credit line is drawn, on screen and in the print layout · oms-react tests
- [x] The panel signals "drawn" once, after the engine reports its tiles and points painted · oms-react tests
- [x] The panel signals "cannot draw" when the engine fails to start or the file cannot be read · oms-react tests
- [x] The built app's entry and its board, report and panel chunks do not contain the map's code · a check on the build output
- [x] The built map chunk and the style name no address on another host that the page would fetch; the credit's link is the one allowed · a check on the build output, wired into `lint`
- [x] The proof page draws over the development base-map file with the network off · seen by a person, screenshot under `.issues/assets/`

## Boundaries

No door is called here: the panel takes points. No switch is read here. The base-map file is not in git; the
development file comes from the script of BackOffice 3634, and the README says where to put it. The proof page is
not reachable in a production build.

## Done when

Proof boxes ticked; `test`, `lint` and `build` are green.

## Blocked by

BackOffice 3634 (it chooses the tile layout the style is written for, and makes the development file).

## Comments

**2026-11-17 — built (branch `spec/3630-879`).** `test` 10,868 green (789 files), `build` green; `lint`: the map gate and the
grid/contrast/palette/control gates green, ⚠ `check-boundaries` red with **4 findings that are already on
`spec/3630-map-chart`** (`insurance-rules/aliases` importing `insurance-rules/fields` and `labels`), untouched here.

What it is, for 880–884 and BackOffice 3635:

- **`src/core/map/LazyMapPanel.tsx`** is the door (props `points`, `ariaLabel`, `onDrawn?`, `onCannotDraw?(reason)`,
  `className?`); it lazy-loads `MapPanel.tsx`, the one module that pulls in `maplibre-engine.ts` (MapLibre + pmtiles)
  and `map-style.ts` (`@protomaps/basemaps`). The panel's frame carries `data-map-state` = `drawing` / `drawn` /
  `cannot-draw`, the hook 883's print page and the drives wait on.
- **The logic is a pure module, `map-panel.ts`**, with the engine as a port (`MapEngine.start(start, events)`): the
  stand-in in `map-panel.test.ts` is the "engine replaced" of seam 6. `MapPanel.test.ts` renders the panel to static
  markup for the credit. The MapLibre adapter itself is not unit-tested (seam 6: no library internals); the proof drive
  covers it.
- **Choices:** one point opens centred at zoom 13 (a box of no size has no fit), no points on the M8 box. Points are one
  size (radius 6), `--chart-1` with a `--card` ring, read from the page's tokens (MapLibre takes no CSS variable). The
  zoom buttons stand top-right in English, top-left in Arabic (the reading end; MapLibre corners are physical). No
  rotation or tilt. "drawn" = the first `idle` after the points are added with the base map's tiles and the points'
  source loaded; "cannot draw" = the engine throws on start (`no-graphics`) or MapLibre reports an error **on the base-map
  source** (`basemap-unreadable`); a glyph or sprite error is not a "cannot draw". Exactly one ending is signalled, and
  nothing after `close`.
- **The credit** is the panel's own element (MapLibre's attribution control is off: it is a collapsible button), bottom
  end corner, isolated LTR (unisolated, Arabic put the "©" at the far end — seen on the first drive). Its words are the
  licence's, the same in both languages, so `MAP_CREDIT` is a constant, not a locale key. One credit only (BackOffice
  3634: the Protomaps layout needs no second one).
- **Arabic:** `layers(..., { lang })` of `@protomaps/basemaps` asks for `name:ar`. ⚠ Its water labels are set in Noto Sans
  Italic, whose Arabic range file is **empty** (26 bytes), so under Arabic the style swaps Italic for Regular (tested).
  The dev file (central Riyadh) holds no sea, so an Arabic sea label was not *seen*; that look falls to 3635/3644 with
  the release file. The text-shaping add-on is set eagerly on an Arabic screen and deferred on an English one (an
  English map still meets Arabic-only names).
- **Assets, all on our site and pinned:** `maplibre-gl` 5.6.0, `pmtiles` 4.3.0, `@protomaps/basemaps` 5.7.0 (exact, in
  `package.json`). Vendored under `public/map/` (copied into `dist/` by the build): glyphs Noto Sans Regular/Medium/Italic
  + `OFL.txt` and sprites `grayscale{,@2x}` from `protomaps/basemaps-assets` @ `028c18f7`, and the add-on as
  `rtl-text/mapbox-gl-rtl-text-0.3.0.js` + its `LICENSE.md` (vendored, not an npm dependency: the package's `exports`
  hide `dist/`). 12 MB, 775 files.
- **The base-map file in development** is served by `tools/basemap-dev-file.mjs`, a middleware on `vite` and `vite preview`
  at `/basemap/ksa-bh.pmtiles`, answering byte ranges with 206 (tested), from
  `C:/Work/DMSCO/analytics-release/basemap-dev-riyadh-20261116.pmtiles` or `OMS_BASEMAP_FILE`. Not under `public/`, so a
  build never carries it.
- **The build gate, `tools/check-map-build.mjs`, in `lint`:** builds the app in memory with `LazyMapPanel` as a second
  entry (so the map chunk exists before any screen draws a map) and fails if the entry or any analytics/copilot chunk
  reaches map code by static imports, or if the map's chunks, its CSS or `public/map/**/*.{js,json,css}` name an address
  on another host outside a six-entry allow-list (the credit link, the SVG namespace, and four links/messages inside
  MapLibre and pmtiles, each with its reason). Mutation-checked both ways: a static `MapPanel` import in
  `AnalyticsBoardPage` and an `https://unpkg.com/...` in the style each turned it red.
- **The proof page** `/dev/map-proof` (`?lang=ar` for Arabic) exists only under `import.meta.env.DEV`: the production build
  has no route, no chunk and no `map-proof` string. Outside the shell and the session guard (it calls no door; the PDF
  renderer opens it with no session). `tools/map-proof-drive.mjs` drives it in headless Edge (software graphics) with
  every request to another host aborted: en and ar both `drawn`, 0 outside requests attempted, every base-map answer
  206, no 4xx, no console error. Screenshots: [en](assets/879-map-proof-en.png), [ar](assets/879-map-proof-ar.png) —
  20 points over central Riyadh, street names in English / shaped Arabic, zoom buttons at the reading end, the credit.
  ⚠ **The last Proof box is left open**: it says "seen by a person", and only the agent has looked at the screenshots.
  Every other box is ticked; the ticket goes `done` when a person has looked (`npx vite`, then `/dev/map-proof` and
  `/dev/map-proof?lang=ar` with the network off, or the two screenshots).

**2026-11-17 — seen by the owner.** The owner looked at the screenshots/PDFs under `.issues/assets/` and said they look fine, and to stay with the map decisions (dots sized and coloured, names on the card, no pins, no always-on labels). The person-check box is ticked and the ticket closed.
