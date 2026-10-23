---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\2952-competed-delivery-callout-spec.md
blocked-by: — (live: BackOffice 2965)
---

# 543 — HQ reads the dispatch scorecard and drills to the bids behind a figure

## What to build

**The Dispatch scorecard** for BackOffice spec 2952. Brief: the spec's `## Comments` → "oms-react hand-off", point 3,
and its scorecard measures table; decisions `C:\Work\DMSCO\BackOffice\.issues\2948-how-best-and-worst-are-measured.md`
and `2950-the-oms-react-dispatch-visibility-screens.md` `## Answer` points 3, 5, 6 (scorecard = variant A, B as the
store drill target, C not built); prototype `C:\Work\DMSCO\BackOffice\.scratch\proto\2950-dispatch-visibility-screens\index.html`.

- **Model** `core/models/dispatch-scorecard.ts` from BackOffice
  `Sartawi.Retail.Data\Modules\Callouts\Scorecard\DispatchScorecardModels.cs`: the grid (stores + staff rows,
  ranked figures, context columns, "too few" flag), the drill rows and the store card. Figure names are the row
  field names (`DispatchScorecardFigures`).
- **Feature** `features/oms/dispatch-scorecard/` (own namespace, EN + AR), `api.ts`, all cookie-gated on
  `DispatchScorecard` Display 03, query `from, to, type, channel, city, region, store`:
  - `GET DispatchScorecard/Grid` (stores and staff in one reply);
  - `GET DispatchScorecard/Drill` (+ `figure`, `staff`);
  - `GET DispatchScorecard/StoreCard` (`store` required);
  - `GET DispatchScorecard/Access` → `{ screenAllowed }`.
  - Refusals: `CALLOUT-301` range over 92 days, `302` reversed range, `303` unknown figure, `304` store required.
- **Page** `/oms/dispatch-scorecard`: AG Grid with **Stores** and **Staff (own actions only)** tabs; the five ranked
  columns each labelled with its better direction; best and worst = the two directions of the header sort;
  `compareFigures` (the delivery-statistics store table's helper) with nulls last; "too few" rows sorted last;
  context columns never ranked (fallbacks received, released after award by reason, …).
- **Drill:** every ranked figure (and lost races) is a link opening a drawer of the bids behind it; a bid row opens
  that delivery's Activity (542). A **store name** opens its report card: the five measures with "#n of m", the
  estate median, where its bids went (a stacked bar), the context chips and its staff.
- **Range:** the last 30 days by default, a picker capped at 92 days; filters in the URL. `grid-xlsx` export of the
  grid and of the drawer.
- **Gate:** menu leaf and `ScreenGate` on `screenAllowed`, fail closed. The Staff tab has the same gate.

## Spine reach

model · api · logic (figure cells, direction labels, too-few ordering, drill link, card view) · route + menu + gate +
page + drawer + card · export · i18n EN + AR · test

## Proof (→ `tdd` red-green cycles)

- [ ] figure logic: direction labels; nulls last both ways; "too few" rows last; context columns not sortable as
      ranks; card "#n of m" and estate median shown as sent (vitest)
- [ ] range: default 30 days; over 92 days blocked before the call; each `CALLOUT-30x` maps to its message (vitest)
- [ ] drive script, LTR and RTL, against a stub serving Grid, Drill, StoreCard, Access (allowed and not) and a bare
      403: both tabs, a header sort both ways, a figure opening its drawer, a store opening its card, export offered
- [ ] `npm run typecheck`, `npm run lint`, `npm test` green

## Boundaries

- Doors: BackOffice 2965 (built and merged on `pricing2`); stubbed until deployed with the owner's SQL
  (`Modules/Sd/Sql/056`, `Modules/Callouts/Sql/001`) and `Seed-DispatchScorecard-Screen-Authorization.sql`.
- The figures are computed by the door; the screen never recomputes a rank or a median.
- C's follow-up list is not built (2936 map fog "Follow-up loop").

## Done when

The Proof boxes are ticked: on the running app (stubbed), HQ ranks stores and staff over a range, drills any figure
to its bids, and opens a store's report card.

## Blocked by

— (live: BackOffice 2965 deployed)

## Open questions

- Win rate leaves beaten bids out of its denominator (the ticket and ruling 2948 D3); the spec's table says every bid
  but withdrawn. Owner to confirm on the BackOffice side; nothing changes here either way.
- City / region filter here is the store's area; the board (541) filters on the delivery address's city.
