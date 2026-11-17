---
status: done
spec: BackOffice C:\Work\DMSCO\BackOffice\.issues\3630-the-map-chart-stores-as-points-on-a-map-spec.md
blocked-by: 908
---

# 909 — On Google's map, points are sized and coloured from the legend, nearby stores group with `@googlemaps/markerclusterer` under our count, sum and neutral rules, and a point shows its card

## What to build

BackOffice spec 3630 M15 to M20 and M23, unchanged by the 2026-11-17 move to Google (BackOffice ADR 0139); this
ticket redraws on the Google engine of 908 what 881 drew on MapLibre. The owner saw groups overlap in the MapLibre
walk; grouping over Google's map must not.

- **Points as 881 drew them.** Each store a circle sized by area from its share of the legend's range
  (`pointRadius`), filled with its colour step's token, a hollow point at the smallest size with its colour as the
  ring, `--map-ring` around a filled one. Drawn as Google markers (908's open question decides the marker kind).
  The pure rules of `map-drawing.ts` stay the rules; nothing of the legend or of `map-chart.ts` changes.
- **Groups with `@googlemaps/markerclusterer`** (exact version), its algorithm chosen and tuned so that **no two
  groups and no group and point overlap on screen** at any zoom: the cluster radius is at least the widest group
  circle (`groupRadius`) plus the widest point. Our renderer draws each group as today: one neutral colour
  (`--map-group`), its words the count, and the sum only when the legend says the size adds up (`groupSum`,
  `formatSum`). The panel adds only there (M20).
- **A click on a group** zooms in until it opens (markerclusterer's own click, or `openingZoom` where it differs).
  Nothing joins from zoom 18, as today.
- **The card** as 881 and the review left it: pointing shows the store's name, city and both figures, pointing away
  hides, a tap pins, a tap elsewhere closes, a tap on another store pins that one, the card follows its store and
  stays in the box (`cardAfter`). A group has no card.
- **The proof drives redrawn on Google:** the Riyadh groups that open on zoom, in both languages.

## Proof (→ `tdd` red-green cycles)

Seam 6 of the spec, with the engine (and the clusterer) replaced by stand-ins; prior art is 881's tests, which stay
green where their rule is unchanged.

- [x] Each point reaches the engine at its radius, colour and hollow state from `map-drawing.ts` · oms-react tests
- [x] The group renderer: count always, the sum only for an additive size, one neutral colour whatever its members' colours · oms-react tests
- [x] The clusterer's radius is never smaller than the widest group plus the widest point, so groups cannot overlap · oms-react tests
- [x] A click on a group eases to the zoom where it opens · oms-react tests
- [x] The card rules of 881 hold through the Google adapter's pointer and tap events · oms-react tests
- [x] Mutation check: colour a group by its first member once, and watch the neutral-colour test fail
- [x] Riyadh's stores as groups that open on zoom, no overlap, the card, in English and Arabic, on the local stack with a real map answer · seen by a person, screenshots under `.issues/assets/`

## Boundaries

The legend, the steps and the row's colour step are the server's (BackOffice 3639); the panel compares no value with
an edge, as today. No new figure is computed beyond the group sum of M20. Behind `Analytics:MapChart`.

## Done when

Proof boxes ticked; `test`, `lint` and `build` are green (the known pre-existing `check-boundaries` findings aside).

## Blocked by

908.

## Open questions

- **markerclusterer's algorithm.** Default: its SuperCluster algorithm with the radius rule above and `maxZoom` 17.
  If its groups do not match 881's look (a group's circle sized from its label), say so here before tuning further.
- **`featuresAt`'s greedy grouping** of 881 is no longer how groups are made. Default: it goes with 911, with the
  MapLibre adapter that called it; `groupSum`, `groupRadius`, `pointRadius`, `openingZoom` and `cardAfter` stay.

## Comments

**2026-11-17 — built** (branch `spec/3630-909`, off `spec/3630-google-build` at 908's `eba107e3`). Status stays **open**:
the last proof box is a person's look.

Open questions, answered:

- **Grouping: our own, not `@googlemaps/markerclusterer`.** The panel's `featuresAt` is already the one source the
  panel reads a tap, a group's opening zoom (`openingZoom`) and the card's fold against (review W4, W8). Letting the
  clusterer make the groups would put a second grouping beside it: a click would have to ask SuperCluster for its
  expansion zoom, the card's fold would have to ask the clusterer which store went where, and the 881 tests would test
  a grouping nobody draws. So the clusterer is not added (no new package); `groupsAt` stays the grouping and is made
  overlap-proof instead (below). `featuresAt`, `groupSum`, `groupRadius`, `pointRadius`, `openingZoom` and `cardAfter`
  all stay; nothing goes to 911 from this file.
- **Groups never overlap.** `groupsAt` (map-drawing.ts) now (1) projects on Google's **256-pixel** tiles (MapLibre's were
  512, so on Google every distance was read twice too large — part of why groups crowded), (2) joins as 881 did (40 px,
  greedy, in order), then (3) joins any group whose circle — sized from its words (`groupRadius`), **ring included**
  (`RING_WIDTH`, drawn outside the radius) — would meet another group's or a point's, again until none does. That is the
  rule the ticket's "radius ≥ widest group + widest point" was a proxy for, proved directly: no pair overlaps at any zoom
  5–17 on 60 seeded Riyadh stores, count-only and with a sum line, measured with the test's own Google projection.
  Two lone points are left as 881 left them (more than 40 px apart). `openingZoom` takes the same `grouping`, so a click
  opens to where the groups drawn actually split. Nothing joins from zoom 18.
- **Markers: one Google `OverlayView` of HTML elements, no map ID.** Classic `Marker` icons cannot carry a group's two
  lines (a label is one line), and `AdvancedMarkerElement` needs a map ID that is not served. The overlay is in
  `overlayMouseTarget`; each feature is a `div` styled by `markerLook` (map-markers.ts: radius, fill or `transparent` for
  hollow, ring outside the radius, larger under smaller, groups above points, the group's words `white-space: pre`,
  `dir="auto"` so an Arabic sum reads right to left). Remade when the whole zoom changes, placed with
  `fromLatLngToDivPixel` on every `draw()`. `preventMapHitsAndGesturesFrom` keeps a marker's hits off the map. So a served
  `maps.mapId` is still passed to the map, but nothing needs it. 908's `plainPoint` left the port: the plain point is a
  feature like any other (`PLAIN_INK`, `POINT_RADIUS.plain`).
- **Hits:** `markerHits` (map-markers.ts) turns `pointerenter`/`pointerleave`/`click` on a marker and Google's map `click`
  into the port's `pointer`/`tap`, each target carrying the zoom its marker was drawn at (W8). A map click within 400 ms
  of a marker tap is that same tap and closes nothing.

Found on the drive and fixed: **a copilot map answered before the analytics model had loaded drew its table for good.**
The panel rightly says `no-key` while the model (and its `maps` key) is still loading, but `MapBody` kept that fall-back
after the key arrived. Now a cannot-draw holds only for the key it was tried with (`mapCannotDrawHolds`, map-chart.ts),
so the map is tried again when the key arrives. The print page reads its model before it draws, so it is unchanged.

Tests (vitest): `map-markers.test.ts` (new, 12: the drawn look of a filled, the largest and a hollow point, z-order, the
group's neutral colour, count, sum line and z-order; the card rules through the adapter's hits, the same-tap guard, a
group click to its opening zoom, W8), `map-drawing.test.ts` (+4: no overlap count-only and with sums, still grouped at
a city zoom and apart at 17, every group at 9/11/13 opens at the zoom the panel names), `map-chart.test.ts` (+3:
`mapCannotDrawHolds`). Mutation checks: a group coloured by its first member turns 2 neutral-colour tests red; before
step (3) existed, and before the rings were counted, the overlap tests were red (36 and 90 overlaps; then 1 with
rings). `npm test` 804 files / 11,067 tests green; `typecheck` green; `build` green; `check-map-build`,
`check-grid-base`, `check-contrast`, `check-palette`, `check-controls` green; `check-boundaries` only its 4 known
insurance-rules findings.

Local check with the owner's real key (never in a tracked file; the drive is in the session scratchpad): 908's copilot
map drive, with 36 central-Riyadh stores (each of 908's 12 with two neighbours) so groups form, against `vite` on
`localhost:5209`, Google's hosts let through, every other outside host aborted (0), no console errors. Both languages
`drawn`, Google `3.66.13d`, logo and terms on the map.

- English, zoom 10: groups `24 / 1.4M`, `5 / 190.8K`, `6 / 166.6K` and one point, one group colour, 0 overlaps
  (measured on the drawn elements). A click on the 24 opens it at zoom 11 into 8 groups and 4 points, 0 overlaps.
  Pointing at a store shows its card, a tap pins it, pointing away leaves it pinned; three zoom-outs fold the store into
  one group of 36 at zoom 8 and its card closes.
- Arabic (RTL, zoom buttons at the left): the wider Arabic sums (`1.8 مليون`) make bigger circles, so at zoom 10 the 36
  are one group; a click opens it at zoom 11 into 4 groups and 3 points, 0 overlaps; the card, pin, fold as in English.

Screenshots `.issues/assets/909-copilot-map-{groups,opened,card}-{en,ar}.png`. Not yet looked at by a person — the last
box stays open.

Note for the drives: `vite` serving the map chunk after an edit to a map module can fail the lazy import (the map then
reads "cannot draw" with no request to Google); restart the dev server after editing.

**2026-11-17 — seen by the owner.** The owner looked at Riyadh's stores on the Google map today, in English and
in Arabic: the stores as groups that open on zoom, no overlap, and a point's store card (screenshots
`.issues/assets/909-copilot-map-{groups,opened,card}-{en,ar}.png`). The last Proof box is ticked; the ticket is closed.
The same look ticks BackOffice 3645's panel-walk box.
