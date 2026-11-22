---
status: done
spec: BackOffice 4165
blocked-by: 946
---

# 947 — The kingdom map shades the regions, shows each pharmacy as a point, and opens a pharmacy's scorecard

Spec: BackOffice `E:\Projects\BackOffice\.issues\4165-retail-command-center-phase-1-the-overnight-store-scorecard-product-health-and-morning-brief-spec.md`.

## What to build

- **The map** on the right of the home, drawn with Google Maps through the same component and key path as the
  analytics map chart. Only coordinates and pharmacy codes are used on the map; no figure is sent to Google.
- **Zoomed out:** the five regions and Bahrain, drawn from a small boundary file shipped with the front end, shaded
  by their share of flagged pharmacies.
- **Zoomed in:** each pharmacy a green, amber or red point.
- **The filter:** all issues, sales, stock or delivery. It changes the shading, the points and the region table.
- **The region table** beside the map: pharmacies scored, flagged count and share per region.
- **Selecting a region** zooms to it. **Selecting a pharmacy** opens the scorecard panel: the six measures with
  colour, own figure and peer figure, and two buttons (open the store profile; ask the copilot).
- A pharmacy code in the brief opens the same panel.

## Spine reach

routes → map and panel

## Proof (→ `tdd` red-green cycles)

- [x] the filter changes the points, the shading and the table together · vitest
- [x] selecting a pharmacy opens its scorecard with six measures · vitest
- [x] a pharmacy code in the brief opens the same panel · vitest
- [x] a new pharmacy shows "new" on the growth measures · vitest
- [x] a pharmacy with no coordinates is counted under the map and not drawn · vitest

## Boundaries

Front end only. Needs Google Maps billing approved for this use.

## Done when

The tests are green, and on dev the map shades the regions and a pharmacy opens its scorecard.

## Blocked by

[946](946-the-command-center-home-shows-the-morning-brief-the-status-line-and-the-language-switch.md)

## Open questions

The boundary file for the five regions and Bahrain: the mock used open boundary data; its licence must allow shipping
it, and the borders must match the official map of the kingdom.

## Comments

**2026-11-22 — done (stubbed; live walk owed, BO 4176 unbuilt).** The home's end half
(`features/analytics/command-center/KingdomMap.tsx`): the kingdom map through `@/core/map/LazyMapPanel` with the home's
`maps` key (only codes and coordinates go to Google; `groupNearby={false}` so no red point hides in a neutral group),
the filter (`?filter=all|sales|stock|delivery`, four chips) changing the points, the shading and the region table
together (`map-view.ts`), the region table (a plain `<table>`, not AG Grid, so it follows the live `?lang=ar`; a
region's name is a button that zooms to it, as tapping its shape does), and the count of pharmacies with no
coordinates under the map. Zoomed out (below zoom 6) only the shapes show; zoomed in, each pharmacy is a point in its
stored colour (`--success`/`--attention`/`--danger`; not scored under the filter = hollow `--map-same`). A region's fill
is the server's `shade` step → `--map-none` / `--map-scale-1..5`; the page picks no colour. A map point or a pharmacy
code in the brief puts `?store=` in the URL, which opens `ScorecardPanel` (core `SideSheet`): the six measures with
colour, own and peer figure (a new pharmacy's growth measures read "New", a thin delivery "Not scored"), context
figures, and "Open the store profile". **For 950:** `ScorecardPanel` takes `action?: (scorecard: CcScorecard) =>
ReactNode`, drawn beside the profile link; it draws no Ask of its own. `CcScorecard.ask` is in the model.

`core/map` additions, all optional props, every existing map test green: `polygons` (Google `Polygon`, beneath lines and
points, `--card` edge, opacity 0.55), `onSelect({ kind: 'point' | 'shape', id })`, `pointsFromZoom`, a controlled
`view` (moved by value without restarting the map; a view set before Google draws is the one it opens on), and
explicit `lang`/`dir` for a page with its own language. New model block: `CcScorecard`, `CcMeasure`
(`GET CommandCenter/Scorecard?storeCode=&lang=`, `⚠ proposed`). The contrast gate now holds `--success`/`--attention`/
`--danger` on `--card` in the light map block.

Proof: `map-view.test.ts` (filter → points, shading, rows; region → view), `kingdom-map.test.ts` (the five boxes at the
page, static render with a seeded cache + stubbed `api.get`), `map-panel.test.ts` + `google-engine.test.ts` (shapes,
selection, zoom threshold, set view). Honest note on the loop: the page components were written ahead of their page
tests, so the red step for boxes 2-5 was shown by mutation (panel removed, "new" branch removed, coordinate filter
removed: each turned its box red). Typecheck and the full suite green; five of six lint gates green, the boundary gate
red only on the pre-existing `insurance-rules/aliases/door-shapes.test.ts`. `tools/command-center-drive.mjs` gains
scenario 4 (stubs in `tools/command-center-stubs.mjs`: `mapPart`, `scorecard`) but is not run: no Playwright here.

**Open questions / follow-ups:**
- **Boundary file licence and the province → region ruling.** `regions/ksa-bh-regions.json` (11 KB) is built by
  `tools/command-center-regions.py` from geoBoundaries (Saudi ADM1 + Bahrain ADM0, commit 9469f09), **CC BY 4.0**:
  shipping is allowed with attribution, given under the map ("Region borders: geoBoundaries, CC BY 4.0"). Whether
  geoBoundaries' borders match the kingdom's official map is not established — the owner (or GIS) must rule. The five
  sales regions are the store dimension's `ksa_region`, not administrative regions: each province was assigned to the
  region holding most of its stores in the 3515 mock (Center = Riyadh, Al-Qassim, Hail; East = Eastern; North = Tabuk,
  Northern Borders, Al Jawf; South = Asir, Jazan, Najran, Al Bahah; West = Makkah, Al Madinah). **Provisional; owner to
  rule.** Region keys are `Center|East|North|South|West|BH` (⚠ proposed — BO 4176 must send the same keys). Regions are
  simplified independently, so a shared border can show a hairline sliver.
- **BO 4176 shape:** per-region `shade` step per filter, `notOnMap`, the `maps` part on the home answer (not in 4176's
  text; today the key rides `Analytics/Model`), and the scorecard route's shape are all this client's proposal.
- **Google Maps billing** must be approved for this use (IT, spec 4165). Each filter change draws the map again (a new
  points/shapes identity restarts it), i.e. one more map load; a later core change could swap features in place.
- **Google labels' language** follows the page's `lang` at the first map of the page only: Google's script loads once
  per page in one language, so switching language after the map has drawn keeps the first language's place names.
- **Live walk owed:** on dev, the map shading the regions and a pharmacy opening its scorecard, once BO 4176 (and the
  scorecard route) and `commandCenterOn` are deployed.
