---
status: open
spec: 043
blocked-by: —
---

# 044 — appliedBonusBuysSplitBuyFromGetByConditionKey

## What to build

The `Pricing/Simulate` response surfaces the buy↔get relationship the engine already computes but
today discards. On the **applied** side, each fired bonus buy's application is split into its
**prerequisite (buy)** and **reward (get)** item lists instead of a single flat `affectedItemNumbers`,
and every applied condition carries the role/link fields the client needs to draw an exact connector:

- `isPrerequisite`, `isCondition`, `conditionKey` (optionally `bbyItemIndex`) copied through onto the
  applied condition projection (the engine stamps them on `PcCondition` in `BbyProcess`).
- `AppliedBonusBuy` groups its fired rows by `conditionKey` and, per application, lists
  `buyItemNumbers` vs `getItemNumbers` (a row that is both prerequisite and its own discounted reward —
  a buy-line set-price — appears in both, unambiguous via `conditionKey`).
- Applied `discountType` normalised to the clean **N / % / R / P** code (or both raw SAP + clean
  carried), so the four-kind label map applies uniformly to applied and potential promotions.

Pure **projection pass-through** — no new pricing computation. Ground truth + field map in the
[taxonomy](040-sim-promo-shape-taxonomy.TAXONOMY.md) §"target applied contract".

## Spine reach

model/api (server DTO + `SimulationResultBuilder` projection) · test (server-side)

## Proof (→ `tdd` red-green cycles)

- [ ] a fired same-SKU 1+1 yields one `AppliedBonusBuy` with the trigger piece in `buyItemNumbers` and
      the free piece in `getItemNumbers`, sharing one `conditionKey` · server unit
- [ ] a cross-product reward (buy A → get B free) splits A into buy, B into get on one application · server unit
- [ ] a grouping prerequisite (any 2 of a category → reward) lists both trigger lines in `buyItemNumbers` · server unit
- [ ] a buy-line set-price lands the same item in both `buyItemNumbers` and `getItemNumbers` under one `conditionKey` · server unit
- [ ] applied `discountKind` is the clean N/%/R/P for each of the four kinds · server unit

Verify in the SIS.Pricing / BackOffice repo's own test tier against the engine's `PcCondition` rows.

## Boundaries

**Different repo** — SIS.Pricing.Core / BackOffice (map 484 / spec 503; server slice 509). This is the
server contract the client's exact buy→get relationship consumes. No React. The client (045) ships a
degradation path so the front-end chain is not hard-blocked on this landing.

## Done when

`Pricing/Simulate` returns applied bonus buys with per-application `buyItemNumbers`/`getItemNumbers`
split by `conditionKey` and a normalised `discountKind`, verified by the server unit tests above.

## Blocked by

None — can start immediately.
