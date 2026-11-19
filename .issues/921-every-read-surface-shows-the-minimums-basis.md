---
status: done
spec: BackOffice 4040
blocked-by: BO 4044, 920
---

# 921 — Every read surface shows the minimum's basis

## What to build

Wherever oms-react shows a bonus buy's header minimum, it says which kind it is:

- **Bonus-buy detail modal:** the Min / Max line gets an "(incl. VAT)" suffix (EN/AR) when the mark is on.
- **Bonus-buy inquiry grid:** a column for the mark.
- **Simulator's missed promotions:** the minimum in the promo view is labelled with its basis, read from the engine
  result's `minValueInclVat`.

The models gain the field: the inquiry/detail header and the simulation `PotentialBonusBuy`. Prerequisite minimums are
unlabelled, because they are always excl. VAT. The call-centre guidance strip is out of scope (it shows no header
minimum; spec 4040 comment, 2026-11-19).

Spec: `C:\Work\DMSCO\BackOffice\.issues\4040-a-bonus-buys-minimum-value-can-be-including-vat-spec.md`.

## Spine reach

UI (detail modal, inquiry columns, simulator promo view)

## Proof (→ `tdd` red-green cycles)

- [x] the detail min/max text carries "incl. VAT" only when the mark is on · `core/bonus-buy` tests
- [x] the inquiry columns include the mark column · `bonus-buy-inquiry` tests
- [x] the promo view labels a marked header minimum and leaves prerequisite minimums unlabelled · `simulation/promo-view` tests

## Boundaries

Needs BackOffice 4044 (detail and inquiry) and the 4041 engine result field (simulator).

## Done when

The Proof tests are green, and a stubbed drive shows all three surfaces with a marked and an unmarked bonus buy.

## Blocked by

BackOffice [4044](C:\Work\DMSCO\BackOffice\.issues\4044-bonus-buy-detail-and-inquiry-report-the-mark.md), [920](920-an-author-marks-a-bonus-buys-minimum-as-incl-vat-in-the-editor.md)

## Comments

- 2026-11-19 (`/implement-spec`): **done, stubbed** on branch `spec/4040-min-incl-vat` (228fd750; review fixes 6e891ebe), not merged to main. BackOffice 4044 and 4041 are still open, so the live walk is owed. Drives: `tools/bby-inquiry-drive.mjs` 108/109 (the failure, "Pricing menu shows the BBY Inquiry leaf", also fails without this change); `tools/sim-bby-gate-drive.mjs` 24/24.
  - Guessed contract: `minValueInclVat` on the `Bby/List` row, the `Bby/Detail` header and `Pricing/Simulate` `potentialBonusBuys[]`; absent reads as off (shared reader `src/core/bonus-buy/min-basis.ts`). The CSV exports an absent mark as `false`.
  - Detail modal Min / Max now uses the currency-aware formatter (BHD shows 3 dp; SAR unchanged). The suffix "(incl. VAT)" follows the whole `min / max CUR` value; the mark belongs to the minimum only.
  - The simulator missed card gains a new line, "Requires a basket minimum of 100.00 SAR [incl. VAT]", on every card with a header minimum (it showed no header minimum before). An unmarked minimum carries no "excl. VAT" label; ruling open. Prerequisite minimums stay unlabelled.
  - **AR deferred:** `bonus-buy-inquiry` and `simulation` have no ar namespace (pre-existing).
  - Glossary: "incl. VAT minimum / basis" not yet in `CONTEXT.md` (`/domain-modeling`).
