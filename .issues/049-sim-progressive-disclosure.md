---
status: wontfix
spec: 043
blocked-by: 047
---

# 049 — aPromotionBlockRevealsTodaysConditionAndPricingDetail

> **Superseded 2026-07-25 by [map 097 — The POS Simulation screen rework](097-simulation-screen-rework.md).**
> The disclosure question is re-answered inside the new whole-screen arrangement by
> [103 — Where the deep layers live](103-sim-deep-layers-placement.md), which covers this block's two
> layers plus the line detail, the condition cards and the elements trace under one disclosure
> grammar. Building this against the arrangement 097 is replacing would be work done twice.

## What to build

Progressive disclosure preserves today's full analyst detail end-to-end — nothing the current surface
showed is removed, it moves one interaction deeper. Two layers off a fired-promotion block:

- **Pricing detail** (per block): expands to today's aggregated **condition cards** for the block's
  lines — **reusing** the existing pure `aggregateConditions` + `ConditionCard` (a re-composition, not
  a re-implementation), with the statistical-conditions toggle intact.
- **Advanced detail** (page-level toggle): reveals the raw **pricing-elements** trace (today's Pricing
  Elements tab, surviving as the advanced layer) and a **condition-type column** on the results grid.

The Advanced toggle reflects presence of pricing-elements data (the run must have asked for it), matching
today's behaviour. The analyst path — block → condition cards → pricing-elements — is unbroken.

## Spine reach

component (block disclosure + Advanced toggle; reuse `aggregate`/`ConditionCard`/pricing-element cols) ·
i18n (`simulation` keys) · test (app-drive)

## Proof (→ `tdd` red-green cycles)

- [ ] expanding a block's "Pricing detail" shows the aggregated condition cards for its lines · component (RTL, when runner lands)
- [ ] the statistical-conditions toggle still hides/reveals statistical rows · component (RTL, when runner lands)
- [ ] the Advanced toggle reveals the pricing-elements trace + the grid condition column · component (RTL, when runner lands)

Runner not installed — verify via `npm run typecheck` + drive `npm run dev`: run with pricing-elements
requested against live `SIS.Api`, confirm block → cards → advanced trace all reachable.

## Boundaries

Reuses existing detail modules (no re-implementation). New `simulation` i18n keys (disclosure labels,
Advanced toggle). Pricing Elements survives as the Advanced layer; no endpoint change.

## Done when

A block reveals today's condition cards (with the statistical toggle) and the page's Advanced toggle
reveals the pricing-elements trace + grid condition column, verified in the running app; typecheck green.

## Blocked by

[047](047-sim-promo-blocks.md) — the disclosure hangs off the fired-promotion blocks.
