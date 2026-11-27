---
status: done
spec: BackOffice 4354
blocked-by: 971, BO 4393, BO 4391
---

# 972 — The results page's five reading tabs

Spec: BackOffice `.issues/4354-the-sourcing-advisor-plans-an-orders-shipments-and-comparison-runs-judge-it-before-anything-obeys-spec.md` (the sourcing advisor spec; sections 11, 17 and 19 for the screens).

## What to build

- Breakdowns: rows by mode, city, channel or day, with the rows "a line the stock figure could not cover" and "the channel's own split", who made the run and why no checkout run was used, and the runs with pairs cut by the cap.
- Outside the advisor's rules: by the refused pin's reason, a share bar and one sentence each, and a line saying these orders are a group of their own.
- Promise and stock checks: Dawaa Now by distance band; the shelf chance table (36 cells, a mode switch, a second switch "Picks" or "Counts by half-year"); the eight short-figure rows marked "from deliveries" with their one-line and every-delivery ratios and the lines per channel group; the fixed note on the two ratios; each mode's fleet ratio; the window and the number of counts.
- Later slots: one sentence and a bar per hour, labelled "evidence for phase 2".
- Orders not run: by reason.

## Spine reach

oms-react: page / models / locales / tests

## Proof (→ `tdd` red-green cycles)

- [x] `breakdowns-model.test.ts` — the rows and columns for each of the four groupings · vitest (`npm test`)
- [x] `shelf-chance-evidence-model.test.ts` — cells with their evidence; rows with both ratios; "too few" where so · vitest (`npm test`)
- [x] `later-slots-model.test.ts` — the count by hour · vitest (`npm test`)
- [x] `tools/sourcing-results-drive.mjs` — open each tab, in both languages · Playwright drive, run by hand against stubs

## Boundaries

—

## Done when

The model tests are green and the drive passes.

## Blocked by

[971](971-the-comparison-results-page-one-sentence-one-bar-three-panels-where-the-plans-differ-and-a-figur.md),
BackOffice 4393 (`.issues/4393-the-results-doors-answer-the-bar-the-panels-the-breakdowns-and-the-orders-behind-a-figure.md`),
BackOffice 4391 (`.issues/4391-the-evidence-pass-counts-lines-per-cell-and-row-and-gives-each-store-its-short-figure-factor-and.md`)

## Comments

**2026-11-27: done on stubs. Must be reconciled with BO 4393 and BO 4391.** BO 4393 (the results doors) names
the content of the tabs' replies, and BO 4391 (the evidence pass) names its counts. Neither names a path, a query name
or a field. As the orchestrator ruled, the tabs are built on a wire I designed and on a drive stub. Every path or field I
invented carries `// PROVISIONAL (spec 4354: not specified)` in the code. When BO 4393 and BO 4391 are built, change
these to match:

- **Doors** (`readingTabsApi` in `src/features/oms/sourcing-results/api.ts`). Each tab reads its own door when it opens,
  with the page's `ResultsQuery`:
  - `GET SourcingAdvisor/Results/Breakdowns`, plus the query name `by` (`MODE`|`CITY`|`CHANNEL`|`DAY`)
  - `GET SourcingAdvisor/Results/OutsideRules`
  - `GET SourcingAdvisor/Results/Checks`
  - `GET SourcingAdvisor/Results/LaterSlots`
  - `GET SourcingAdvisor/Results/NotRun`
- **Reply fields and codes** (the "five reading tabs" section of `src/core/models/sourcing-results.ts`):
  - `ResultsBreakdownsReply`: `rows`/`total` of `ResultsBreakdownFigures` (`orders`, `samePlanWhole`,
    `samePlanStores`, `estimateMiddle`, `promiseKept`, `late`, `returned`, `cancelled`, `endedNoStock`), `stockShort`,
    `channelSplit`, `storePassedOver`, `madeBy`, `noCheckoutRun`, `pairsCut{runs, lineNotAvailable, cities[]}`.
  - The codes in the Breakdowns tab: the mode rows (`SLOT_ONLY`, `DAWAA_NOW_ONLY`, `SLOT_AND_DAWAA_NOW`,
    `BEYOND_BORDER`); the city key `OTHER` for "Other cities"; the split parts (`ONE_DAWAA_NOW`, `ONE_SLOT`, `OTHER`,
    from BO 4283 decision 39); the run makers (`CHECKOUT`, `OMS`); the no-checkout reasons (`NONE`, `CART_CHANGED`,
    `HAD_PINS`).
  - `ResultsOutsideRulesReply{orders, reasons[{reason, orders, percent}]}`. A reason is BO 4281's filter step code
    of the refused pin, plus an invented `BOOK_NEVER_HELD`. `percent` is the reason's share of the orders outside the
    rules.
  - `ResultsChecksReply`:
    - `dawaaNow{band, bands[{band, count, percent}], expressStampPercent}`, with the bands `KM_0_2`, `KM_2_4`,
      `KM_4_6`, `KM_6_PLUS`.
    - `stock{covered, notCovered}` of `{ended, noStock, percent}`.
    - `shelf{set, window{from, to, counts}, halves[3], modes[{mode, fleetRatio, cells[36]}], rows[8]}`.
    - Each cell is `{asked 1..6, leftOver L0|L1|L2|L3_4|L5_9|L10_PLUS, chance, lines, failed, failedPercent,
      expectedFailed, reading, halves[3]}`.
    - Each row is `{stockClass, mode SLOT|PICK_UP, chance, oneLine, everyDelivery, groups[{group APP_SITE|CC_OUTBOUND|CC_OTHER, oneLineLines, everyLines}], reading}`.
    - The readings are `TOO_FEW`, `INSIDE_CHANCE`, `ENOUGH_TO_CHANGE` and `NOT_STEADY`.
  - `ResultsLaterSlotsReply{orders, slotOrders, percent, middleLaterMinutes, byHour[{hour, orders}]}`. Decision 12's
    "middle difference" names no unit. The prototype shows it in riyals, but decision 4 says riyals appear on one order
    only. So the page reads it as minutes later (`middleLaterMinutes`). **Owner confirmed minutes, 2026-11-27.**
  - `ResultsNotRunReply{orders, reasons[{reason, orders}]}`, with the codes `WORKER_OFF`, `TOO_LATE`,
    `NO_RUN_AFTER_ATTEMPTS` and `STOCK_READ_FAILED`.
- **Figure encoding** (`src/features/oms/sourcing-results/reading-figure.ts`, `ResultsReadingFigure`):
  `breakdown:<BY>:<key>`, `stockShort:<CLASS>:<MODE>`, `channelSplit:<PART>`, `storePassedOver`, `madeBy:<MAKER>`,
  `noCheckoutRun:<REASON>`, `pairsCut:<city|ALL>[:LINE_NOT_AVAILABLE]`, `outsideRules:<REASON>`,
  `distanceBand:<BAND>`, `stockCheck:<COVERED|NOT_COVERED>[:NO_STOCK]`, `laterSlot[:<hour>]`, `notRun:<REASON>`.
- **The stub** that both the model tests and the drive read: `src/features/oms/sourcing-results/stub-tabs.json`. It holds
  the results prototype's 14 days, and the shelf cells are spec §6's baseline table.

**What was built:**

- The five panels are registered in `ResultsTabs.tsx`. The Trials and Phase 2 bar tabs are left for 973.
- **Breakdowns.** A row switch, kept in the tab's own state and not in the URL. Nine columns with the total row as
  sent. The rows "a line the stock figure could not cover" and "the channel's own split", plus three cards: who made the
  run, pairs cut per city, and the own store passed over.
- **Outside the advisor's rules.** The line saying these orders are a group of their own, then a `ShareBar` and one
  sentence per reason.
- **Promise and stock checks.** The summary's promise check, Dawaa Now by distance band, the express stamp, the stock
  check, and the 36-cell shelf chance table. It has two switches, one for the mode and one for Picks or Counts by
  half-year. The eight short-figure rows come with both ratios, the fixed note, fleet ratios, the window and the counts.
- **Later slots.** The sentence, the "evidence for phase 2" pill, and a bar per hour drawn with `core/charts`
  `VerticalBarChart`.
- **Orders not run.** The reasons, the total, and what is not counted.

**Rules and choices:**

- No riyal figure and no new colour token. The shelf cells are shaded with `core/charts/sequential`. No green and no
  red.
- No new hand-written control.
- en and ar keys are both added.
- "Too few" is drawn wherever a figure expects under 50 failed lines, whatever reading the server sent.
- `Panels.tsx` now exports `PromiseCheck`, `Gauge`, `PILL` and `STATE_PILL`, so the tab can reuse them.
- Not built: the optional reading by band of the category's factor (results ticket, the amendment by BO 4307). The
  ticket's list does not include it.

**Proof:**

- 28 new vitest cases in the three model tests (9 + 12 + 7). `npm test` is green, 12,792 tests in all. `typecheck` and
  `lint` are green.
- `tools/sourcing-results-drive.mjs` passes 191/191 on Edge (`PLAYWRIGHT_CHANNEL=msedge`), in LTR and RTL. Each
  of the five tabs opens and its figures open their orders.

**2026-11-27 — Reconciled with BackOffice 4393 and 4396 at pricing2 35a4e56be** (branch `reconcile-results`). The
doors are `Results/Breakdown?by=` (`MODE|CITY|CHANNEL|DAY|MADE_BY|OWN_SPLIT|SHORT_FIGURE`, one grouping per read,
every figure a count, the total keyed `TOTAL`), `Results/Outside` (by the refused pin's code and the filter step that
removed the pair), `Results/Checks` (the promise check, Dawaa Now by band with the express stamp, the stock check by
mode), `Results/LaterSlots` (all 24 hours, with the count of later slots cheaper) and `Results/NotRun` (not run, and run
by OMS itself, by reason). "Who made the run", the channel's own split and the short-figure orders are now groupings of
the Breakdowns tab. The shelf chance evidence (rows by mode and stock class, the server's verdict, the halves and
fleet ratios) rides on BO 4396's `Results/Phase2Bar` reading. Stubs: `stub-tabs.json`, `stub-bar.json`.
- SERVER GAP (spec 4354): the 36 shelf chance cells, the every-delivery ratio, the lines per channel group, "Counts by
  half-year" and the window's count of full counts; the short-figure rows by stock class; "of the runs with pairs cut,
  those with a line not available"; "the order's own store passed over"; the later slots' middle difference; orders
  figures for a distance band, a stock check row or a not-run reason (plain counts).
