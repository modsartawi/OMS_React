---
status: open
spec: BackOffice 4354
blocked-by: 962, BO 4379
---

# 966 — The solver tab draws the funnel, the stock per line, the trade-off, what was tried and the flow graph

Spec: BackOffice `.issues/4354-the-sourcing-advisor-plans-an-orders-shipments-and-comparison-runs-judge-it-before-anything-obeys-spec.md` (the sourcing advisor spec; sections 11, 17 and 19 for the screens).

## What to build

- Five diagrams from the full level of the run record:
- the funnel: every pair, then each filter step with the pairs still standing; a step opens to every pair it removed with the rule's words; a run with a cut shows the pairs cut;
- the stock per line: for one line, every store: on hand, less open demand, times confidence, less buffer, equals offered, against the quantity needed; the expected stock at pick time beside it, shown only;
- the trade-off: every kept plan as a point, time against money, shaped by number of deliveries, the shown plans marked;
- what was tried: the ten best whole plans for a goal with "show more", what each lost by and the part that cost most; a goal picker; the search counts;
- the flow graph: cart lines, the pairs that can serve a line, the shipments of the selected plan, the plan; grey for could have served, coloured for chosen; drag, zoom, pan, a mini-map.
- The flow graph is drawn with React Flow, a new dependency: pick the package and version for React 19, load it only when the graph opens, keep its attribution mark. The others use plain components and the chart library already here.

## Spine reach

oms-react: page / models / new dependency / tests

## Proof (→ `tdd` red-green cycles)

- [ ] `funnel-model.test.ts` — the steps, the pairs standing after each, and the cut · vitest (`npm test`)
- [ ] `stock-per-line-model.test.ts` — the working for one line from the inputs · vitest (`npm test`)
- [ ] `tried-model.test.ts` — the best plans for a chosen goal and what each lost by · vitest (`npm test`)
- [ ] `flow-graph-model.test.ts` — the nodes and edges for a selected plan · vitest (`npm test`)
- [ ] `tools/sourcing-simulator-drive.mjs` — open each diagram; the flow graph's bundle loads only then · Playwright drive, run by hand against stubs

## Boundaries

New dependency (React Flow), loaded lazily.

## Done when

The model tests are green, the drive passes, and the main bundle does not grow by the graph library.

## Blocked by

[962](962-the-simulator-builds-a-cart-runs-it-and-shows-the-plans-as-cards-or-as-one-table.md),
BackOffice 4379 (`.issues/4379-the-run-record-carries-every-figure-the-run-read-at-three-levels-with-a-code-for-every-reason.md`)
