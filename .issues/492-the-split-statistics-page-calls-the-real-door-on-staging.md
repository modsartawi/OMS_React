---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\assets\2660-oms-react-statistics-by-track-brief.md
blocked-by: 489, 490, 491
---

# 492 — The split statistics page calls the real door on staging

## What to build

The by-track page (489–491) reads the real `GET SdDocumentWeb/StoreStatistics` on staging, and its
numbers agree with the till.

- Extend `tools/delivery-statistics-live-drive.mjs` (488's live drive) to the lanes, the misses rows
  and the table's track views.
- **Till parity:** for one store and one period, the lanes, misses rows and lane averages equal that
  store's till Statistics tab.
- **Totals vs rows:** for one figure, the all-stores lane equals the table's Delivery / Pick-up view
  summed by eye (the server proves this in BackOffice 2660; this is the eye check, not client code).
- Confirm the live wire matches the model field for field (camelCase, no `outForDelivery` on
  `pickUp`, `unspecified` on totals and rows); fix the model if it drifted.
- Owner walk.

## Spine reach

model/api (live confirmation) · test (live drive)

## Proof (→ `tdd` red-green cycles)

- [ ] Live drive green against staging — flow (drive)
- [ ] One store's page matches its till for the same period (recorded in Comments with the store + period) — manual
- [ ] Owner walk signed off — manual

## Boundaries

Live: BackOffice 2658–2660 deployed to staging and the `055` re-summary run. Read-only door — nothing
is written.

## Done when

The live drive is green on staging, the till parity check is recorded, and the owner has walked it.

## Blocked by

[489](489-the-statistics-page-draws-a-delivery-lane-and-a-pick-up-lane.md),
[490](490-each-track-has-its-own-did-not-go-to-plan-row.md),
[491](491-the-per-store-table-switches-between-delivery-pick-up-and-all.md)

## Open questions

- Is BackOffice 2658–2660 deployed to staging with `055` run? This is the first task.
