---
status: open
spec: BackOffice 4127
blocked-by: 934, BO 4129
---

# 935 — A category manager scans the product grid: one row per material, one column per competitor

## What to build

The **Grid** tab (BackOffice spec 4127, decisions 6 and 8), on BO 4129's endpoint.

- **One row per watched material.** Our column first: the effective price, with the basic price beneath it and
  any deal text.
- **One column per competitor.** Each cell shows:
  - the paid price; the regular price struck through and the offer % when there is an offer;
  - the seller on a marketplace;
  - the observed time.
  The cell states are drawn distinctly: `OOS` (with its last price), `NOT_CARRIED`, `NO_MATCH`,
  `COMPARABLE_ONLY`, and stale.
- **The cheapest cell** in each row is marked, including ours when we lead.
- Filters: A-level, B-level, brand, competitor, "a competitor is cheaper than us". Sorts: our units (default),
  widest gap. Server paging.
- A row opens the material drill-down (936). Until 936 ships, the row is not a link.

Spec: `C:\Work\DMSCO\BackOffice\.issues\4127-price-command-center-release-1b-mindsite-as-a-second-source-the-page-and-the-product-grid-spec.md`.

## Spine reach

UI (grid tab, wire types, api)

## Proof (→ `tdd` red-green cycles)

- [x] each cell state renders its own way (PRICED with offer, OOS, NOT_CARRIED, NO_MATCH, COMPARABLE_ONLY, stale) · component test (pure)
- [x] the cheapest mark follows the endpoint's flag, ours included · component test
- [x] filter and sort are sent to the endpoint · component test
- [x] a marketplace cell shows its seller · component test

## Boundaries

Needs BO 4129.

## Done when

Proofs green, and the grid walked on dev.

## Blocked by

[934](934-the-price-command-center-page-opens-on-the-price-alerts-with-accept-and-dismiss.md), BackOffice [4129](C:\Work\DMSCO\BackOffice\.issues\4129-the-product-grid-shows-each-competitors-authoritative-price-beside-our-effective-price.md)

## Comments

**2026-11-22 — built (branch `t935-product-grid`), proofs green, drive 28/28; status stays open (dev walk + BO 4129).**

- ⚠ **Built on a GUESSED contract — reconcile owed.** BO 4129 is not built. The wire types sit in the Grid section of
  `src/core/models/price-watch.ts` under a `⚠ GUESSED (BO 4129)` header; `priceGridApi.page` says so too. Guesses:
  route `GET PriceWatch/Grid`; query `aLevel`, `bLevel`, `brand`, `competitor`, `competitorCheaper=true` (sent only when
  asked), `sort=units|gap`, `page` (1-based) + `pageSize` (50); answer `{ total, page, pageSize, competitors[{
  competitorCode, name, kind, authoritativeSource }], rows[{ materialNumber, title, brand, aLevel, bLevel, currency,
  basicPrice, effectivePrice, isPriced, dealText, appliedDealText, thirtyDayUnits, isCheapest, widestGapPercent,
  cells[] }] }`; a cell `{ competitorCode, state, paidPrice, regularPrice, offerPrice, offerPercent, sellerName,
  isPlatformSeller, inStock, observedAt, isStale, isCheapest, gapPercent, source }`. Cells are read by `competitorCode`,
  never by position. If BO pages with `skip`/`take` instead, only `gridRequest` and the model change.
- Cell drawing is one pure function, `cellView` (`grid.ts`); `GridCells.tsx` only renders it. A state the client does not
  know draws as "unknown state", never as a price. The cheapest mark is the endpoint's `isCheapest` (cell, and
  `row.isCheapest` for ours) — no client comparison, so ties and source choice stay the server's.
- The seller shows only on a `marketplace` column (a pharmacy sells its own stock). Deal text = `appliedDealText`, else
  `dealText`.
- Server sort and paging, so client column sort is off. No pinned columns (`pinned: 'left'` is a physical side under
  RTL; no other grid pins). A row is not a link: 936 adds the drill-down.
- Drive `tools/price-grid-drive.mjs` (stubbed `**/api/**`, GUESSED grid stub, shipped Coverage). Note: a cold vite on
  a busy box took minutes to optimise deps, so the drive sets a 180 s default timeout.

**2026-11-22 — row wired to the drill-down (936 merge, branch `t936-drilldown`).** The grid's material cell
(`GridTab.tsx` `MaterialCell`) now draws `DrillDownLink`: the material number opens the material drill-down by
`?material=` (the open tab kept; `drillDownSearch` in `drilldown.ts`). "A row opens the material drill-down" holds.
