---
status: open
spec: BackOffice 4354
blocked-by: 962, BO 4381
---

# 964 — A replay shows what happened beside the plans, and the map shows every plan's stores

Spec: BackOffice `.issues/4354-the-sourcing-advisor-plans-an-orders-shipments-and-comparison-runs-judge-it-before-anything-obeys-spec.md` (the sourcing advisor spec; sections 11, 17 and 19 for the screens).

## What to build

- Start a run by replaying an order: the order number, then its lines, channel and time. A replay on today's figures says so on screen: "planned on today's figures, not the order's".
- "What happened": a dashed card, or the table's last column: the store and mode routing chose, when it was delivered, late or not, the fee, and one sentence against the Recommended plan.
- The map tab, on the Google map panel: every plan's stores at once, coloured by mode, the pick-up leg dashed, each labelled with its distance to the customer; a switch narrows to the selected plan; a dotted line joins one plan's stores. Two tables under it: each store with its mode, plan, road and straight-line distance; and the distances between the stores. The panel gains a dashed line and the 5 km and 10 km rings.
- The customer's pin can be moved (click places, drag moves), in a replay too: the run plans again on the drop, the replay is marked "customer's point moved by hand" and "What happened" is hidden until "Back to the order's point".
- The customer-point switch sends `withCustomerPoint`. Without the grant a replay shows no pin, rings or legs, says why the point was withheld, and every km stays exact.

## Spine reach

oms-react: page / map panel / models / locales / tests

## Proof (→ `tdd` red-green cycles)

- [ ] `what-happened-model.test.ts` — the card's facts and its one sentence from a replay reply · vitest (`npm test`)
- [ ] `map-plans-model.test.ts` — stores by mode, the two tables, and nothing drawn when the point is withheld · vitest (`npm test`)
- [ ] `map-drawing.test.ts` — a dashed line and the two rings · vitest (`npm test`)
- [ ] `tools/sourcing-simulator-drive.mjs` — replay an order, open the map, move the pin, go back · Playwright drive, run by hand against stubs

## Boundaries

—

## Done when

The model tests are green and the drive passes.

## Blocked by

[962](962-the-simulator-builds-a-cart-runs-it-and-shows-the-plans-as-cards-or-as-one-table.md),
BackOffice 4381 (`.issues/4381-a-user-replays-an-order-its-own-quantities-are-added-back-and-the-customers-point-shows-only-und.md`)
