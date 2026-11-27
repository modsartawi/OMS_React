---
status: open
spec: 983
blocked-by: 984
---

# 985: Numbered basket lines, with how each was priced underneath

Slice of [spec 983](983-the-console-is-built-around-the-caller-spec.md). Reference picture: the
*Call Center Console v3* artifact (v3).

## What to build

The basket becomes the grid from the mock-up:
- a `#` column numbered by position (D4);
- the name, with the item number, the VAT class and the offer as a quiet second line;
- a quantity stepper, price, discount and total.

Clicking a line opens its pricing detail underneath: basic price, each condition by name, net, then
**VAT as rate and amount** (D5, which fixes "Vat % 20.32"), then the line total. A line below its
store's ATP keeps its existing pill.

## Spine reach

pure (`basket-view.ts` line numbers + detail rows) · component (`BasketPanel`) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `linesAreNumberedByPositionAfterAVoid`: voiding line 2 of 4 renumbers 3→2 and 4→3 · pure
- [x] `vatReadsAsRateAndAmount`: a 15% line shows the rate and the amount, and a medicine line shows 0% · pure
- [x] Drive: expanding and collapsing a line; keyboard reaches the stepper and the expander · flow

## Boundaries

No wire change: the rate comes from the line's VAT condition, which `conditions` already carries.

## Done when

The basket is numbered, the pricing detail is right on a real NOV10 order, and the drive is green.

## Comments

**2026-11-27: built on branch `t/985`. The live NOV10 check is still owed.**

Built:
- `basket-view.ts` (pure):
  - `lineNumber` on each view and `lineNumbers(state)` (a `lineId` → number map, which 987's promotions panel can use). Both are 1-based positions in the engine's order, recomputed from every state. They are display only and never sent.
  - `linePricing(line)` builds the detail rows: each non-VAT condition in the server's order · `net` (`lineTotal.net`) · `vat` {rate, amount} · `total` (`lineTotal.gross`).
  - Each view also carries `unitPrice` (`unitPrice.gross`), `discounts` (each negative, non-statistical, non-VAT condition, listed and never summed) and `vatRate`.
- `BasketPanel` is now the grid: # · item · qty · price · discount · total · void.
  - The item column's second line holds the item number, `VAT 15%` / `VAT 0%`, the offer, the frozen ATP pill and the below-ATP flag.
  - The qty column has a − / field / + stepper. − is held at one unit, because zero is a void.
  - The chevron (`aria-expanded`) or a click on the name opens the pricing detail under the line. An open detail is held by `lineId`, so it stays with its line through a renumber.
  - Names wrap instead of truncating. Under RTL an ellipsis cut off the start of a Latin name.
- i18n: `lineGrid.*` keys in en and ar.

Proof:
- `basket-view.test.ts` +8 cases (25/25). `npm test` 12852/12852, typecheck clean, lint clean.
- `tools/callcenter-basket-drive.mjs` 47/47. It covers 1366/1024 LTR and 1366 RTL, numbers, VAT class, expand/collapse (chevron and name), VAT reading "VAT 15% · 3.47" and "VAT 0% · 0.00", Tab from the search reaching the expander, the qty field and both steps, Enter/Space on the expander, `+` sending `ChangeQty {newQty}` with no money, and a void of line 2 of 4 renumbering 3→2 and 4→3.
- Re-run: rail 100/100, shell 123/123, store-change 58/58.
- `callcenter-drive` box 34 was retargeted. It now expands the line first, and the offer is read from the line's own second row.
- Failures that are already on `spec/983-caller-console` without this slice:
  - guidance drive: "two offers sharing one blank offerId" fails, 154/155.
  - item-panel drive: two StockElsewhere checks fail.

Decisions for the owner:
- **The VAT rate is not on the wire.** `CallCenterLineCondition` is type · description · value · isStatistical, and live MWST reads `"Vat %"` beside the amount. The rate is therefore taken in this order:
  1. a percent written in the condition's own description;
  2. 0 when the amount is 0 (medicine);
  3. otherwise the condition's amount over `lineTotal.net`, rounded to a whole percent.

  This is a ratio of two server figures, not an amount, but it is still client arithmetic. A tiny line could round off 15. The clean fix is an additive `rate` on the condition: the engine's `SimulationResultCondition` already has `ConditionRate`. That needs a BackOffice ask, which is unfiled.
- **A line with no VAT condition shows no VAT row and no class.** It never shows an invented 0%.
- **Columns:**
  - *Price* is `unitPrice.gross`: the per-unit price the caller pays, after discount.
  - *Discount* lists each discount condition's line-level value.
  - The mock-up's "catalogue price before discount" per unit would need dividing `VKP0` by qty, so it was not built.
- **`ar/callcenter.json` still has no `basket.*` / `line.*` keys** (from 170), so those labels fall back to English under Arabic. They are untouched here.

Owed:
- The live check on a real NOV10 order on the walk set-up (local SIS.Api on production): the numbers, and a detail whose VAT row reads 15% and the right amount, with medicine reading 0%.
