---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\assets\2641-oms-react-delivery-statistics-brief.md
blocked-by: 484, 485, 486, 487 (live: BackOffice 2639 + 2641 deployed and backfilled)
---

# 488 — The statistics page calls the real door on staging

## What to build

Point the Delivery statistics page at the real `StoreStatistics` web door on staging and prove it.

- **Confirm the route** against BackOffice 2641's door contract doc, and fix `api.ts` if the stub
  drifted.
- **Live drive:**
  - Today, Yesterday and a 31-day Range, for all stores and for one store, with the leave-outs on
    and off.
  - The 32-day guard makes no call.
  - AsOf is at most 5 minutes old.
- **Parity check:** for one store and one period, the web's figures equal the POS Statistics view
  on the till, figure for figure. This includes Trips and Avg hand-over.
- **Totals check:** with no store chosen, the totals equal the sum of the `Stores[]` rows.

## Spine reach

api (live) · test (live drive + owner walk)

## Proof

- [ ] The live drive is green against staging.
- [ ] Parity is recorded in this ticket: the store, the period, and the web vs till figures.
- [ ] An owner walk is signed off.

## Boundaries

- This ticket needs BackOffice 2639 (the aggregator, plus its backfill) and 2641 (the door)
  deployed to staging.
- Read only: nothing is written.

## Done when

The live drive is green, the parity check is recorded with no disagreement, and the owner has walked the page.

## Blocked by

[484](484-an-hq-user-sees-today-s-delivery-statistics-across-all-stores.md), [485](485-an-hq-user-narrows-the-statistics-to-one-store-and-chooses-the-leave-outs.md), [486](486-the-page-draws-came-in-and-handed-over-by-hour-for-a-day-by-day-for-a-range.md), [487](487-an-hq-user-ranks-stores-by-any-figure-in-the-per-store-table.md)

## Open questions

- Whether the owner swapped the list grant for a dedicated statistics grant (BackOffice 2641). If so, the menu probe follows.
