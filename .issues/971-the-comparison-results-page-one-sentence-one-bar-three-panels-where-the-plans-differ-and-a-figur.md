---
status: done
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

- [x] `results-bar-model.test.ts` — six segments and the two brackets from a reply; segments add up · vitest (`npm test`)
- [x] `promise-panel-model.test.ts` — inside, under or over the band; pick-up with no band · vitest (`npm test`)
- [x] `differ-rows-model.test.ts` — the estimate and the endings per class; no estimate for outside the rules · vitest (`npm test`)
- [x] `tools/sourcing-results-drive.mjs` — open the page, open a segment's orders, open one order, in both languages · Playwright drive, run by hand against stubs

## Boundaries

Opens under today's advisor view grant. Can start on stubs.

## Done when

The model tests are green and the drive passes in both languages.

## Blocked by

BackOffice 4393 (`.issues/4393-the-results-doors-answer-the-bar-the-panels-the-breakdowns-and-the-orders-behind-a-figure.md`)

## Comments

**2026-11-27 — done on stubs; must be reconciled with BO 4393.** The results doors (BackOffice 4393) are open and name
the content of their replies but no path, query name or field. By the orchestrator's ruling the page is built on a
designed wire and a drive stub. Every invented path and field carries `// PROVISIONAL (spec 4354: not specified)` in
the code. When BO 4393 is built, change these to match it:

- Doors (`src/features/oms/sourcing-results/api.ts`): `GET SourcingAdvisor/Results/Summary` (the top, the three
  panels, "where the plans differ", the candidate and the pickable sets), `GET SourcingAdvisor/Results/Orders` (the
  orders behind a figure), `GET SourcingAdvisor/Results/Order?orderNumber=` (one order's card).
- Query names (`ResultsQuery`): `period` (1|7|14|30), `channelGroup` (`ALL`|`APP_SITE`|`CALL_CENTRE`), `weightSet` +
  `weightSetVersion`, `besideSet` + `besideSetVersion`, `stockShortLine`, `marks` (comma-joined; the three values are
  BO 4281's `solve.marks` codes); for the orders also `figure`, `page`, `pageSize`, `sort`, `descending`.
- The figure encoding (`figure.ts`): `segment:<SEGMENT>`, `class:<VIEW>:<CLASS>`, `promise:<MODE>[:<GROUP>]`,
  `mark:<MARK>`, `runNotEnded`, `notRun`.
- Reply fields and codes (`src/core/models/sourcing-results.ts`): every field of `ResultsSummaryReply`, `ResultsTop`
  (shares as a count plus a one-decimal percent), `ResultsPromiseRow`, `ResultsCost` (counts only, no riyal field),
  `ResultsMarkInForce` (`orders: null` = applies to the page, `0` = greyed), `ResultsDifferRow`, `ResultsOrdersReply`,
  `ResultsOrderRow`, `ResultsOrderCard`; the codes of the views, the eight classes, the seven segments (with
  `BREAKS_NESTING`, the results ticket's "orders that break the nesting get a segment of their own"), the endings, the
  rates and the six marks in force; the channel code `CALL_CENTRE`.
- The simulator link: settled at the 962 merge — the drawer uses `simulatorRunPath` from
  `src/core/sourcing-advisor/simulator-path.ts` (`/oms/sourcing-simulator?run=<runId>`); `simulator-link.ts` is gone.
- The stub reply both the model tests and the drive read: `src/features/oms/sourcing-results/stub-summary.json` (the
  results prototype's 14 days).

Built: route `/oms/sourcing-results` (not in the menu: ticket 974 repoints "Sourcing advisor" here), behind
`canViewSourcingAdvisor` (`SourcingAdvisor:01`); namespace `sourcing-results` (en + ar); colours as `--results-*`
tokens in `global.css` (light + dark; the inks a reader must tell from the card are held by the contrast gate; the
prototype's red "cancelled" became a slate: no green, no red); four hand-styled buttons allowlisted under
`oms/sourcing-results` in `tools/control-baseline.txt`. The pieces are plain components (none of them needed recharts).
Paging and sorting are built, export is not.

For 972 and 973: the seven tabs are in `tabs.ts`; a tab's panel is registered in `ResultsTabs.tsx` (`TAB_PANELS`) and
receives `{ query, summary }`; any figure opens its orders through `<Drill figure count />` (`Drill.tsx`), extending
`ResultsFigure` in the core model and `encodeFigure` in `figure.ts`. "Set beside it" is in the filter bar and sent to the
doors (`besideSet`, `besideSetVersion`); its banner, thin second bar and extra column are 973's.

Proof: 31 vitest cases in the three model tests (`npm test`: 968 files green); `typecheck` and `lint` green;
`tools/sourcing-results-drive.mjs` 85/85 on Edge (`PLAYWRIGHT_CHANNEL=msedge`), LTR and RTL. Under RTL the app's words
stay English (the main app runs `lng: 'en'`), so the RTL pass proves the mirroring (the first segment and both brackets
at the right) and the isolation; the Arabic locale file is in place for when the app switches language.

**2026-11-27 — review 4354 #4: "Open the stored run in the simulator" is hidden.** The simulator never reads `?run=`:
opening a stored run as it was is a read door of its own, not an advise call (BackOffice 4281 decision 11), and neither
that door nor the simulator's reading of the parameter is built. The orders drawer's button and the bar tab's
largest-differences links therefore show only under `canOpenStoredRun` (`src/core/sourcing-advisor/access.ts`), which
is false while `SIMULATOR_READS_RUN` is false, and from then on needs the run grant (`canRunSourcingAdvisor`) — the
results page opens under the view grant, which does not open the simulator. **Gap:** the ticket's "Open the stored run
in the simulator" is not delivered until the simulator gains that read door; turn `SIMULATOR_READS_RUN` on in the change
that builds it. The drive now checks the button and the links are absent.
