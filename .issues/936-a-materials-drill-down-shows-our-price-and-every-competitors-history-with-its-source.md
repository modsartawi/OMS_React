---
status: open
spec: BackOffice 4127
blocked-by: 934, BO 4128
---

# 936 — A material's drill-down shows our price and every competitor's history, with its source

## What to build

The **material drill-down** (BackOffice spec 4127, decision 8), on the existing `Materials/{material}/Comparison`
endpoint, which carries each observation's source after BO 4128.

- Our basic and effective price over time, and each matched competitor's regular and offer price over time, on one
  chart, with the source of each observation labelled (`Scraper` / `Mindsite`). The authoritative source is drawn
  solid and the cross-check source faint.
- The matches (exact / comparable, how made, who and when), with **Break** (Manage grant).
- Comparable matches compared **per unit** (per g, ml, piece).
- It opens from an alert row (934) and from a grid row (935).

Spec: `C:\Work\DMSCO\BackOffice\.issues\4127-price-command-center-release-1b-mindsite-as-a-second-source-the-page-and-the-product-grid-spec.md`.

## Spine reach

UI (drill-down, chart, wire types)

## Proof (→ `tdd` red-green cycles)

- [x] the authoritative series is solid and the other source faint, both labelled · component test
- [x] a comparable match shows the per-unit price · component test (pure)
- [x] break sends and refreshes, and is hidden without Manage · component test

## Boundaries

Needs BO 4128 (source on the comparison). Charts follow the repo's chart conventions.

## Done when

Proofs green, and the drill-down walked on dev.

## Blocked by

[934](934-the-price-command-center-page-opens-on-the-price-alerts-with-accept-and-dismiss.md), BackOffice [4128](C:\Work\DMSCO\BackOffice\.issues\4128-a-competitor-price-records-its-source-and-only-the-authoritative-source-raises-alerts.md)

## Comments

**2026-11-22 — built (branch `t936-drilldown`), stubbed; dev walk + BO 4128 owed.** Proofs green
(`drilldown.test.ts` 16 tests, `core/charts/series-ink.test.ts` +2), drive `tools/price-drilldown-drive.mjs` **30/30**
on stubbed `**/api/**`. Status stays open: the dev walk on `PriceWatch_Dev` and BackOffice 4128 are owed.

- **⚠ GUESSED contract (BO 4128).** Today's `Materials/{material}/Comparison` has no history, no match id, no who/when.
  Built on the guessed additive shape (scratchpad `4127/contracts.md`): `ourHistory[] { priceDay, isPriced, basicPrice,
  effectivePrice }` on the comparison, and per side `matchId`, `matchedByUser`, `matchedAt`, `authoritativeSource`,
  `source`, `history[] { priceId, observedAt, source: SCRAPER|MINDSITE, isAuthoritative, regularPrice, offerPrice,
  sellerName, inStock }`. All OPTIONAL in `core/models/price-watch.ts` (Drill-down section, marked GUESSED): a pre-4128
  server reads as "no price history yet" and Break disabled with its reason (drive step 7), never a crash. No `?days=`
  sent (server default). Reconcile when 4128 ships — if BO ships a separate `Materials/{m}/History` door instead, only
  `priceDrillDownApi.comparison` and `historyChart` change.
- **Opens by URL** (`?material=`, open tab kept, replace): link helper `drillDownSearch(search, material)` /
  `drillDownMaterial(search)` in `src/features/analytics/price-command-center/drilldown.ts`. The page mounts
  `MaterialDrillDown` (a `SideSheet`) once, under the tab strip, so any tab opens it with
  `<Link to={{ search: drillDownSearch(location.search, material) }} replace>`. The alert row's material
  (`AlertMaterialCell.tsx`) is that link now. **935's grid row is NOT wired** (935 not merged) — at merge, make the grid's
  material cell the same link. Switching tab drops `?material=` (the tab strip writes `?tab=` alone) — the sheet closes.
- **Gap sign:** the comparison `gapPercent` is negative when the competitor is cheaper (opposite to the alert's).
  `comparisonGap` reads the sign once and says it in words ("Competitor cheaper by 11.3%" / "We are cheaper by 3.0%"),
  the figure unsigned, so the two wires never meet in one number.
- **Chart:** `core/charts` `SeriesChart` gained two optional, backward-compatible per-series props — `faint` (opacity
  `FAINT_OPACITY` 0.4, line + area) and `dashed` (`'6 3'`, line). Authoritative source solid, cross-check faint; the
  shelf price (our basic, their regular) dashed beside the price paid (our effective, their offer). One line per
  competitor × source × price, each source's latest observation per day; our slot 0, competitors slots 1–4. The chart's
  legend is hidden and an HTML key (`HistoryKey`) names each series' owner, price and source.
- **Per unit:** a comparable match shows the server's `ourPricePerUnit`/`theirPricePerUnit` at 4 dp as one isolated rate
  ("0.8125 / piece", basis translated) — `perUnitView` in `drilldown.ts`. The chart draws a comparable listing's own
  pack price (no sizes on the wire to rescale history by); the per-unit comparison is in the matches table.
- **Break** (Manage only): asks inline first, then `POST Matches/{matchId}/Break`, then invalidates every
  `['price-watch']` query (comparison, alerts, coverage, grid). Refusals (PWT-00025/00026) shown with their code.
- **Drive note:** the app's `lng` is pinned to `en` (Arabic not switched on), so the RTL pass checks direction and
  isolation only; the Arabic strings are proven in the unit tests.
