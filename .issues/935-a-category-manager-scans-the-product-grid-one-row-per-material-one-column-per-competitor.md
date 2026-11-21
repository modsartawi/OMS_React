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

- [ ] each cell state renders its own way (PRICED with offer, OOS, NOT_CARRIED, NO_MATCH, COMPARABLE_ONLY, stale) · component test (pure)
- [ ] the cheapest mark follows the endpoint's flag, ours included · component test
- [ ] filter and sort are sent to the endpoint · component test
- [ ] a marketplace cell shows its seller · component test

## Boundaries

Needs BO 4129.

## Done when

Proofs green, and the grid walked on dev.

## Blocked by

[934](934-the-price-command-center-page-opens-on-the-price-alerts-with-accept-and-dismiss.md), BackOffice [4129](C:\Work\DMSCO\BackOffice\.issues\4129-the-product-grid-shows-each-competitors-authoritative-price-beside-our-effective-price.md)
