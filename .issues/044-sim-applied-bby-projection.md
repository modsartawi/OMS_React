---
status: in-progress
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

## Field evidence — why the client is hard-blocked on `conditionKey` (2026-07-19)

Confirmed against a live `Pricing/Simulate` response. The "applied N×" badge on the fired-promotion
card (client, `promoView.appliedCount`) needs to know how many times one promo fired into its single
card. **No field in today's payload carries that** — only a per-application `conditionKey` can.

Repro: a **"2 PC for 29.95 SR"** set-price (`ZB01`) promo, basket items 10 + 20, that fired **twice**
(2 pieces per application, 4 pieces total). The response:

- `appliedBonusBuys[0]`: one grouped row, `affectedItemNumbers: [10, 20]`, `totalDiscountValue: -72.96`,
  **no `applications[]`**, `remainingUsage: null`.
- Four bonus-buy condition rows (`isBonusBuy:true`, `bbyNumber:"000100000132"`, `conditionType:"ZB01"`),
  each `conditionValue: -18.24`, `conditionBaseValue: 31.26`, `stepNumber: 119`, `conditionCounter: 1..4`,
  two on item 10 and two on item 20. **No `conditionKey`, no `isPrerequisite`/`isCondition`, no `bbyItemIndex`.**

Nothing here groups the 4 rows into the 2 real applications: `conditionCounter` is a flat 1..4 running
index, `conditionValue`/`conditionBaseValue` are identical, and a raw row count = **pieces (4)**, not
applications (2). The client therefore cannot derive the count and **hides the badge** until this lands.

## Implemented — condition-projection half (2026-07-19, BackOffice repo)

Done in **`C:\Work\DMSCO\BackOffice`** (branch `pricing2`), `SIS.Pricing.Services/Simulation/Result/`:

- `SimulationResultCondition` gains `IsPrerequisite`, `IsCondition`, `ConditionKey`, `BbyItemIndex`.
- `SimulationResultBuilder.MapCondition` projects all four from `PcCondition` (pure pass-through). The
  packaged `PcCondition` (SIS.Pricing.Core 26.4.34) already exposes them — reflected & confirmed.
- `dotnet build` of `SIS.Pricing.Services` green; existing `SimulationReachabilityTests` pass against POS_Test.

This satisfies the **first "What to build" bullet** and unblocks the client's "applied N×" count end to end
(the web `promoView` already counts `distinct(conditionKey)` per bby; the badge appears once the response
carries the key). **To see it live the SIS.Api host must be rebuilt/restarted** so the new
`SIS.Pricing.Services` drops in — the running instance won't hot-reload it.

**Still open — the structural split (bullets 2 & 3):** `AppliedBonusBuy.Applications[]`
(`buyItemNumbers`/`getItemNumbers` grouped by `conditionKey`) and the normalised `DiscountKind`. That
type lives in the **`SIS.Pricing.Core` NuGet package**, whose source is a *different* repo — it cannot be
changed from BackOffice. Those bullets, and this ticket's "Done when", remain blocked on the package repo.

**Minimum ask to unblock the badge** (subset of this ticket): stamp **`conditionKey`** onto the applied
bonus-buy condition projection so the rows of one firing share a key (here → 2 distinct keys). The client
already reads it — `SimulationResultCondition.conditionKey` is wired and `promoView` counts
`distinct(conditionKey)` per `bbyNumber`; the badge appears automatically the moment the field is
populated, no client change. The full `applications[]` buy/get split remains the ticket's target; the
key alone is what the count needs.
