---
status: done
spec: 043
blocked-by: —
---

# 045 — promoViewDerivesLinesBlocksAndMissedFromAResult

## What to build

**Slice 0 — the pure view model the whole rework hangs off.** A pure module `promoView(result)` that
turns a `SimulationResult` into the three collections the hybrid renders, plus the model extension it
reads. Verifiable in-memory with fixtures; takeable now (no live server, no backend change) because it
degrades gracefully when the projection (044) hasn't landed.

Model extension (`@/core/models/simulation.ts`), all new fields **optional** so a pre-projection
response still types:
- `SimulationResultCondition` gains `isPrerequisite?`, `isCondition?`, `conditionKey?`, `bbyItemIndex?`.
- `AppliedBonusBuy` gains `applications?: { conditionKey; buyItemNumbers; getItemNumbers }[]` and
  `discountKind?: 'N' | '%' | 'R' | 'P'`; keeps `affectedItemNumbers` for the degradation path.

`promoView(result)` produces:
- `lines[]` — each result item annotated `{ promoKind, role: 'buy' | 'get' | 'buy+get' | null,
  conditionKey }` for the grid's Promotion column (a line under two promotions associates with each).
- `blocks[]` — one per fired promotion (grouped by `bbyNumber`), each with its `applications`
  (buy items → get items resolved from `conditionKey`), `kind`, identity fields (BBY key, promo no.,
  offer id, remaining usage), `totalSaved`, and per-get reward amount + `free` flag.
- `missed[]` — from `potentialBonusBuys`, each with the driving unmet prerequisite (found vs
  required qty / min value) and the would-save figure.
- `degraded: boolean` — records which path ran.

Kind classification maps **N→free, %→percent, R→fixed, P→setprice** (taxonomy 040). Degradation: with
projected fields absent, fall back to `affectedItemNumbers` — one undivided block per promotion, `role`
left null, no `conditionKey` partnering — never throw.

## Spine reach

model (optional field extension) · logic (pure `promoView` module) · test (in-memory fixtures)

## Proof (→ `tdd` red-green cycles)

- [x] `promoViewSplitsSameSku1Plus1IntoOneBlockBuyAndGet` — trigger in buy, free piece in get · pure
- [x] `promoViewTagsCrossProductRewardAsGet` — different reward product resolved to the get side · pure
- [x] `promoViewReadsGroupingPrerequisiteAsMultipleBuyLines` — both trigger lines on one block · pure
- [x] `promoViewMarksBuyLineSetPriceAsBuyGet` — same item both roles under one conditionKey · pure
- [x] `promoViewClassifiesAllFourKinds` — N/%/R/P → free/percent/fixed/setprice · pure
- [x] `promoViewBuildsMissedFromUnmetPotential` — found-vs-required + would-save · pure
- [x] `promoViewDegradesWhenProjectionAbsent` — flat `affectedItemNumbers` → undivided block, no throw · pure

Runner not installed — verified via `npm run typecheck` + a scratch Node harness (Node 24 type-stripping)
over fixtures covering every shape above plus two extras (a line under two promotions carries both refs;
`promoView(null)` yields an empty view): **11 passed, 0 failed**. `npm run build` + boundary lint green.
The module is written test-ready (pure, fixture-driven, companion to `aggregateConditions`) so the harness
transcribes straight into the vitest unit when the bootstrap lands; harness kept in the session scratchpad.

## Boundaries

No API endpoint change (consumes 044's fields when present, degrades when not). No i18n (machine tokens
only — labels are localised at the render tier in 046/047). Does not bootstrap the runner.

## Done when

`promoView` returns correct `lines` / `blocks` / `missed` for every taxonomy shape and the
degradation case, confirmed by the fixture assertions above (typecheck green; scratch-harness verified).

## Blocked by

None — can start immediately.
