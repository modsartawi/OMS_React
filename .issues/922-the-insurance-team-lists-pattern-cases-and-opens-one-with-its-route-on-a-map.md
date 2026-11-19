---
status: open
spec: BackOffice 4050
blocked-by: BO 4053
---

# 922 — The insurance team lists pattern cases and opens one with its route on a map

## What to build

Spec: `C:\Work\DMSCO\BackOffice\.issues\4050-the-insurance-team-sees-patients-who-dispense-across-pharmacies-on-a-map-and-opens-each-case-spec.md`.

- **`/insurance/patterns`:**
  - a case list from `GET Insurance/Patterns/Cases`;
  - filters: store, period, signal, status, severity;
  - columns: case number, stores, dispenses, span, longest leg km, shortest gap, signals, score, status, value;
  - paged, ordered by score.
- **`/insurance/patterns/:caseId`:**
  - **Route map:** the stores on the Google map (ADR 0139, the map chart's loader), joined in time order. Each leg is
    labelled with km and time, and a leg that fired the travel signal is drawn in the warning colour. Delivery
    dispenses show as points without a leg.
  - **Signals:** each signal with its EN and AR words.
  - **Timeline table:** store, time, item, quantity, days' supply, payer, channel, pharmacist.
  - **Marks:** set watching, cleared, confirmed or closed, with a note. A previous clearance of the same patient is
    shown at the top.
  - **Previous cases:** linked.
- **Nav entry** shown only with `INSURANCE_PATTERN_ANALYST`. EN and AR, RTL.

## Spine reach

UI (new `features/insurance-patterns`), API client.

## Proof (→ `tdd` red-green cycles)

- [x] The list renders the filters and paging against a mocked envelope · `filter.test.ts`, drive
- [x] The route draws legs in time order, a travel leg in the warning colour, and delivery as a point without a leg · `route.test.ts` (mutation-checked), `map-lines.test.ts`, `google-engine.test.ts`, drive
- [x] A mark round-trips, and the previous clearance banner shows · `mark.test.ts`, `api.test.ts`, drive
- [x] Without the grant there is no nav entry and the route shows "no access" · `access.test.ts`, `menu-insurance.test.ts`, drive
- [x] Arabic layout (RTL) snapshot · drive (screenshots in Arabic words, see Comments)
- [ ] Lint + build clean — build clean; lint red only on the 4 pre-existing boundary hits in `insurance-rules/aliases/door-shapes.test.ts` (see Comments)

## Boundaries

- **No reveal here.** That is 923.
- **No patient field exists in the models at all.**

## Done when

Proof is green against mocks, and there is a live walk on BO 4053's local endpoints with seeded cases.

## Blocked by

- BackOffice 4053

## Comments

**2026-11-19 — built and proven against mocks; stays `open` for the live walk on BO 4053.** The case list at
`/insurance/patterns` and the case screen at `/insurance/patterns/:caseId`, a new **Insurance** nav group (last,
beside Insurance rules), EN + AR, RTL. No patient field exists anywhere: the case models declare none and the doors'
answers are rebuilt field by field, so a stray identity field from a server never reaches the query cache.

- **Where (deviates from this ticket's "new `features/insurance-patterns`"):** `/insurance/*` is a new URL prefix and
  nav group, so per `feature-structure` it is an area: `src/features/insurance/patterns/` (area `insurance`, feature
  `patterns`), namespace `insurance-patterns` (EN + AR, registered in `core/i18n.ts`). Routes in a new
  `src/app/insurance-routes.tsx`, menu in a new `src/layout/menu-insurance.ts`, each mounted once, with slot comments
  for 923 and 924. Models in `src/core/models/insurance-patterns.ts`.
- **The map:** `@/core/map` drew points only; it now takes optional **lines** (`MapLine`: two ends, a colour token,
  words, and `strong`), backward compatible — a map given none draws exactly as before and every earlier map test is
  unchanged. Google draws each as a `Polyline` with its words at its middle on the markers' overlay. `route.ts` turns a
  case into points and lines: one point per store visited (sized by its dispenses), the server's legs in time order,
  numbered and labelled "1 · 312 km · 1 h 40 min", a travel leg in the map's warning orange and drawn above the others;
  a delivery dispense a point with no leg in or out (even if a leg were sent); a store without coordinates listed, not
  drawn. With no `maps` part (or Google refusing) the legs show as a table numbered as on the map.
- **Tests (vitest):** `access`, `api` (at the `@/core/api` seam, incl. a detail answer carrying three identity fields
  that are all dropped), `filter`, `route` (delivery exclusion, travel tone and time order mutation-checked), `mark`,
  `units`, `i18n-keys` (EN/AR mirror, six Arabic plurals, every built key), `no-identity` (source contract on the
  models and the reader, mutation-checked), `layout/menu-insurance`, `core/map/map-lines`, and new cases in
  `core/map/google-engine` (polylines, words, `strong` stacking, cleanup). The three tail-order menu tests (Deliverect,
  HungerStation, Insurance rules) shift by one for the new last group. Full suite green.
- **Drive** `tools/insurance-patterns-drive.mjs`: **77/77** on the real app against `tools/insurance-patterns-stubs.mjs`
  (the shared fixtures and a door-handler factory 923/924 reuse) and a stand-in for Google's Maps script, so the real
  adapter is watched drawing with no key, no billed load and no network: no grant (two near-misses) → no nav entry,
  "no access" on both routes, no door asked; the list's filters each sent under the door's name and kept in the URL,
  back on page 1, a backwards period refused and never asked, Clear, a pasted address, paging and the server's order;
  the case screen (header, the clearance banner and its link, the route: three legs in time order, the travel leg in
  `--map-worse` and on top, Dammam's delivery a point with no leg, labels, four points, the unplaced store), signals in
  EN and AR, the timeline, previous cases; a mark round-trip (held with its reason, posted trimmed with no actor, the
  case re-read without restarting the map, an Arabic note as typed), a refused mark keeps its draft; with no key the
  legs table and Google never asked; RTL with the Arabic bundle switched on: facts, grid, timeline and filters read
  right to left, leg words "1 · 312 كم · 1 س 40 د". Screenshots: `922-insurance-pattern-case-rtl-ar.png` and
  `922-insurance-pattern-list-rtl-ar.png` in the session scratchpad (`SHOT_DIR`; the drive rewrites them).
- **Guessed — reconcile when BO 4053 lands (BackOffice asks):**
  - `GET Insurance/Patterns/Cases?storeCode&from&to&signal&status&severity&skip&take` → `{ items, totalMatches }`,
    ordered server-side by score then the last dispense; `from`/`to` are local `yyyy-MM-dd` days, inclusive (which
    date of a case they compare is the server's).
  - `GET Insurance/Patterns/Cases/{caseId}` → the detail shape in the model (stores with `lat`/`lon` or null, legs
    `{ fromEventId, toEventId, km|null, minutes, kmPerHour|null, travel }` between consecutive counter dispenses,
    `signalWords { kind, en, ar }`, `marks`, `previousClearance`, `previousCases`); `0001-01-01T00:00:00` = still open;
    an unknown case a business 404.
  - `POST …/Cases/{caseId}/Marks` `{ status: watching|cleared|confirmed|closed, note }` → the new mark
    `{ status, note, by, at }`; the client requires a note and refuses past **500** characters (4053 says only
    `NVARCHAR`, `StringMaxType`, clamped); refusals shown with `apiErrorMessage` whatever their code.
  - **The `maps` part on the case detail** (`{ key, mapId? }`, BackOffice 3986's), so the case screen draws Google's
    map without the analytics model. Absent → the legs table.
  - **The grant keys:** a CONTROLLER `InsurancePattern` seeded like 3965 with `InsurancePattern:03` (analyst: list,
    case, marks, nav), `:06` (investigator: 923's reveal, half of 924's block), `:02` (manager: 924), plus 3965's
    `InsurancePatientBlock:02` (Change, the other half of 924's block). All four are in `SCREEN_KEYS`, each read by one
    predicate in `access.ts`; 922 uses only `canOpenPatternCases`.
  - Enumerations spelled lower-case (`open`, `travel`, `action`); the reader lower-cases what it gets.
- **Judgement calls to review:** (1) the travel colour is the map's own warning token `--map-worse`, not `--attention`:
  the map is light only (spec 3630 M33) and `--attention` lightens in the dark theme; the legend and the legs table say
  "travel" in words too. (2) `strong` lines: Hail, Buraydah and Riyadh lie nearly on one line, and the RTL screenshot
  showed a later plain leg hiding the travel leg. (3) Legs between the same two stores are one line with a word line
  per leg. (4) Point size is a fixed scale (5 or more dispenses = full size), the card giving the exact count.
  (5) Signal words show both languages, the screen's first. (6) "All pattern cases" returns to the unfiltered list.
  (7) The crumb shows the case id (the shell shows a route's record param; the spec fixes the URL to the case id).
- **Lint:** grid, contrast, palette, controls and map-build gates are clean (the case map arrives only through the lazy
  door). `check-boundaries` still exits 1 on the 4 pre-existing hits in
  `src/features/insurance-rules/aliases/door-shapes.test.ts` (present on base `7eefd128` and on `main`; this slice
  touches nothing there), so the Lint box stays unticked. Build clean.
- **Not here:** the pager reads English under Arabic because `common`'s Arabic has no `pager.*` keys (pre-existing,
  every paged screen).
- **Still owed:** the live walk on BO 4053's local endpoints with 4051's seeded cases.
