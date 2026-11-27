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

- [ ] `linesAreNumberedByPositionAfterAVoid`: voiding line 2 of 4 renumbers 3→2 and 4→3 · pure
- [ ] `vatReadsAsRateAndAmount`: a 15% line shows the rate and the amount, and a medicine line shows 0% · pure
- [ ] Drive: expanding and collapsing a line; keyboard reaches the stepper and the expander · flow

## Boundaries

No wire change: the rate comes from the line's VAT condition, which `conditions` already carries.

## Done when

The basket is numbered, the pricing detail is right on a real NOV10 order, and the drive is green.
