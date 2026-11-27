---
status: done
spec: BackOffice 4354
blocked-by: BO 4379
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

- [x] `funnel-model.test.ts` — the steps, the pairs standing after each, and the cut · vitest (`npm test`)
- [x] `stock-per-line-model.test.ts` — the working for one line from the inputs · vitest (`npm test`)
- [x] `tried-model.test.ts` — the best plans for a chosen goal and what each lost by · vitest (`npm test`)
- [x] `flow-graph-model.test.ts` — the nodes and edges for a selected plan · vitest (`npm test`)
- [x] `tools/sourcing-simulator-drive.mjs` — open each diagram; the flow graph's bundle loads only then · Playwright drive, run by hand against stubs

## Boundaries

New dependency (React Flow), loaded lazily.

## Done when

The model tests are green, the drive passes, and the main bundle does not grow by the graph library.

## Blocked by

[962](962-the-simulator-builds-a-cart-runs-it-and-shows-the-plans-as-cards-or-as-one-table.md),
BackOffice 4379 (`.issues/4379-the-run-record-carries-every-figure-the-run-read-at-three-levels-with-a-code-for-every-reason.md`)

## Comments

**2026-11-27 — built on stubs (done in oms-react; reconcile with BackOffice 4379 when it lands).** The full level of
the run record does not exist yet. The tab, the models and the drive read BackOffice 4281's worked example (its middle
and full levels), extended in `src/features/oms/sourcing-simulator/advise-reply.fixture.json` with the rest of the rows
a run would carry (step 1, the store lines of stores 1055/1090/1061, twelve kept Recommended plans and a few for Cheapest
and Pick-up, more "why not" rows). When BO 4379 lands, replace the fixture with a captured full-level reply, run the four
model tests and the drive, and settle each provisional name below. BO 4379 stays listed as the blocker for that reason.

What was built:
- Wire types in `src/core/models/sourcing-run.ts`: `AdviseFilterStep`, `AdviseRemovedPair`, `AdviseStoreLine`,
  `AdviseInputStore`, `AdviseInputs`, `AdviseKeptPlan`, `AdviseKeptShipment`, `AdviseWhyNot`, `AdviseSearchCounts`,
  `AdviseSearch`; `AdviseReply.inputs`, `.filterSteps` and `.search` are typed with them (`used` is left to 965).
- Pure models with vitest: `funnel-model.ts`, `stock-per-line-model.ts`, `tried-model.ts` (what was tried and the
  trade-off's points), `flow-graph-model.ts` (library-free nodes and edges).
- The tab: `SolverPanel.tsx`, registered as `solver` in `SimulatorTabs.tsx`'s `TAB_PANELS`. Five diagrams:
  `FunnelDiagram.tsx` (core `StageBar`), `StockPerLineTable.tsx`, `TradeOffChart.tsx`, `TriedList.tsx`, `FlowGraph.tsx`.
  The stock per line and the flow graph follow the plan picked in the strip.
- `src/core/charts/ScatterChart.tsx`: a new core scatter form on recharts (four shapes, marked points labelled, the
  `dir="ltr"` box and mirroring through props like the other forms).
- New dependency **`@xyflow/react` 12.12.1** (exact; React Flow v12, the React 19 line, released 2026-11-02), added with
  `npm install` so `package.json` and `package-lock.json` both carry it. `FlowGraph.tsx` imports the library and its
  stylesheet and is loaded only through `React.lazy` in `SolverPanel.tsx`; a chunk that fails to load says so. The
  attribution mark is kept (`proOptions.hideAttribution` is not set). The canvas is themed from app tokens through the
  library's `--xy-*` variables.
- Locale keys under `solver` in `src/locales/en/sourcing-simulator.json` and `src/locales/ar/sourcing-simulator.json`.
- No hand-written controls (core `Chip`/`Button`, `<details>` for a step's removed pairs): no control-baseline lines.
  No new colour tokens: the chosen path takes the chart slots by shipment (`--chart-1…`), "could have served" ink grey.

PROVISIONAL (spec 4354: not specified) — each marked so in the code:
- `search.kept[].promiseBy`, `.fee`, `.companyCost`, `.waiting` — the run record (BO 4242) says each kept plan has its
  promise, fee, company's cost and price of waiting; 4281's example shows only `rank`, `sum`, `lostBy`, `lostMostOn` and
  `shipments`. The trade-off and the "what was tried" columns read these four; without them a plan is left off the
  chart and its cells show a dash.

Readings to confirm with BO 4379:
- `kept[].sum` is read as the plan's balanced total and `lostBy` in riyals; the winner is `rank: 1` (4281's example
  shows only a rank 2), with `lostMostOn` absent.
- `lostMostOn` values are read as the balanced sum's parts (`COMPANY_COST`, `FEES`, `WAITING`, `COVER`, `SPLIT`, and
  `STORE_RECORD` from `whyNot.difference`); 4281 shows only `WAITING`. An unknown part prints its code.
- The flow graph's candidate pairs are the `search.whyNot[]` rows with no `removedAt` (4281: a "why not" for every pair
  and goal), with the selected plan's own pairs first. It assumes the winning pair has a `whyNot` row too.
- A step's count is `before − after`; the list under it is what the record carries (the middle level names only the
  nearest five out of reach). The funnel's top bar is the first step's `before`.
- The trade-off's height is the fee with the company's cost: drawing geometry only, never printed (4281 decision 28).
- "On hand" is `tillStock`; the book's `sapStock` is shown under it. Open demand is shown as the two held figures, as sent.

Proof as run: `npm test` (977 files, 12,847 tests) with the four new model tests (33 cases); `npm run typecheck` and
`npm run lint` green. `tools/sourcing-simulator-drive.mjs` passes 106/106 on Edge (`PLAYWRIGHT_CHANNEL=msedge`), LTR and
RTL. Its new `solverDrive` opens each diagram and asserts that no request for `FlowGraph` or `@xyflow/react` is made until
the graph opens, then that the boxes, the animated path, the controls, the mini-map and the attribution are there, that a
box drags, and that under RTL the columns run from the right. ⚠ As in 962, the RTL pass reads English words (only
`oms.locale` sets the direction).

Bundle, `npm run build` before and after:
- Main entry chunk `index-*.js`: 313.58 kB (gzip 90.28) before, 314.68 kB (gzip 90.34) after. No xyflow code is in it or
  in any chunk `index.html` preloads (grep for `react-flow__`/`xyflow` finds none). The +1.1 kB is the entry's chunk
  dependency map, which now lists the page's new chunks.
- The library is in its own chunk `FlowGraph-*.js`, 173.41 kB (gzip 54.60), plus `FlowGraph-*.css` 15.41 kB (gzip
  2.56), both loaded on demand.
- `SourcingSimulatorPage-*.js`: 25.49 kB before, 57.47 kB after (the four diagrams and the models).

Merged with `spec-4354-sourcing-advisor` after 963, 964, 965 and 971–973: the wire types sit beside 965's (965's
`AdviseStoreInput` is the one store type; `AdviseInputs` carries both `stores` and `storeLines`; `AdviseSearch`'s parts
are optional), the fixture keeps 965's richer `inputs.stores`, and two cases of 965's `why-not-model.test.ts` now read
the fixture's extra "why not" rows (store 1090's own rows set aside in one case; the stores known only from removals
are now four). Then merged again after 963 (both cart helpers kept in the drive). After the merges: `npm test`
991 files, typecheck and lint green, the drive 186/186 on Edge, and the build's entry chunk still holds no xyflow code.


**2026-11-27 — Reconciled with BackOffice 4355–4381 (4373, 4379, 4380, 4381, 4386) at pricing2 35a4e56be.** Filter steps carry `removedCount` and, for the whole-store steps, `byMode` (steps 1 and 2 are never listed pair by pair); the funnel lists `removed` or the nearest five per mode. `inputs.storeLines` is per store and item with a `working[]` per mode, so the stock per line has a row per store and mode. Kept plans are `RecordKeptPlan` (`by`, `linesServed`, `lostMostOn` as a sum part such as `SPLIT_PENALTY`). No gap left in this ticket's wire. Proof: `npm test`, `npm run typecheck`, `npm run lint` green; `tools/sourcing-simulator-drive.mjs` 222/222 and `tools/sourcing-record-drive.mjs` 96/96 on Edge, LTR and RTL, against stubs serving the server's shapes.
