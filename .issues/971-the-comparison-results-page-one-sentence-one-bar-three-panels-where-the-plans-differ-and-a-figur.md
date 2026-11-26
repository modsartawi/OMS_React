---
status: open
spec: BackOffice 4354
blocked-by: BO 4393
---

# 971 — The comparison results page: one sentence, one bar, three panels, where the plans differ, and a figure opens its orders

Spec: BackOffice `.issues/4354-the-sourcing-advisor-plans-an-orders-shipments-and-comparison-runs-judge-it-before-anything-obeys-spec.md` (the sourcing advisor spec; sections 11, 17 and 19 for the screens).

## What to build

- A new page; the menu entry "Sourcing advisor" will point at it. The prototype `.scratch/proto/4282-comparison-results` in BackOffice is the look, and the ticket's amendments win where they differ.
- The filter bar: the period (yesterday, 7, 14 or 30 days), the channel group, the candidate set by name and version, "Set beside it", a line the stock figure could not cover, the run's marks.
- On top: one sentence ("Of N orders compared, routing chose the advisor's stores for X%, and the whole order shipped as the advisor planned for Y%.") and one bar of six segments, with a bracket above for "the stores only: same stores" and one under for "the whole plan: same plan". Every segment opens its orders. Under the bar one line: orders landed, run and not ended yet, not run.
- Three panels: the promise check (a row per mode with a gauge and the 85% to 95% band; pick-up as two rows, "target, no band"); cost (the notice "No riyal total", then counts; no riyal column anywhere); marks in force (each said once with a count that opens its orders).
- "Where the plans differ": a switch for the view; a row per differing class; the advisor's plan estimated (a dot for the middle order, a bar for half the orders, one neutral colour) beside what happened measured (one endings bar, the customer's own cancellation hatched "shown, not counted"). A fixed note that the page does not say which was better. No green and no red.
- The drawer: any underlined figure opens its orders from the side, paged and sortable; a chosen order shows the advisor's plan beside what happened and the button "Open the stored run in the simulator".
- English and Arabic; desktop width; plain components and the chart library already here.

## Spine reach

oms-react: wire models / page / locales / tests

## Proof (→ `tdd` red-green cycles)

- [ ] `results-bar-model.test.ts` — six segments and the two brackets from a reply; segments add up · vitest (`npm test`)
- [ ] `promise-panel-model.test.ts` — inside, under or over the band; pick-up with no band · vitest (`npm test`)
- [ ] `differ-rows-model.test.ts` — the estimate and the endings per class; no estimate for outside the rules · vitest (`npm test`)
- [ ] `tools/sourcing-results-drive.mjs` — open the page, open a segment's orders, open one order, in both languages · Playwright drive, run by hand against stubs

## Boundaries

Opens under today's advisor view grant. Can start on stubs.

## Done when

The model tests are green and the drive passes in both languages.

## Blocked by

BackOffice 4393 (`.issues/4393-the-results-doors-answer-the-bar-the-panels-the-breakdowns-and-the-orders-behind-a-figure.md`)
