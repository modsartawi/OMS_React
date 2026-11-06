---
status: open
spec: 811
blocked-by: 812, 813, 814, 815, 816
---

# 817 — The situation view works against the real door, and the figures the till shows match it

## What to build

The live half of spec 811. Run Delivery statistics against **staging** SIS.Api once the BackOffice
brief's five asks are built and deployed:

- the `Courier` scope;
- slot keeping;
- `deliveredPerTrip`;
- `avgDeliveryMinutes`;
- the previous block.

Then:

- **Reconcile drift.** Every new field was written as a web proposal (⚠). Where the real wire
  differs, correct the model, the stub and the drive to match it, and record what moved.
- **Drive it live.** Point the extended `tools/delivery-statistics-live-drive.mjs` at staging. Cover
  all couriers and FarEye, Today, Yesterday and a 7-day Range, one store and all stores.
- **Check till parity** on the figures the till also shows (Came in, Handed over, the stages, Trips,
  the misses) for one store and one day. The till's own Avg hand-over is **not** compared, because
  the web no longer shows it.
- **Spot-check the new rules** on a handful of real deliveries:
  - a scheduled evening delivery: Avg delivery time is timed from the slot's start;
  - an early delivery: counted in slot, at 0 minutes;
  - a pick-up carrying the FarEye default courier: absent under FarEye.

## Spine reach

model/api (drift reconciliation) · test (live drive, parity notes)

## Proof

- [ ] live drive green against staging, all couriers and FarEye · flow (Playwright, live)
- [ ] parity recorded: the till's and the web's shared figures agree for one store and one day · manual, noted in Comments
- [ ] the three rule spot-checks recorded with their delivery numbers · manual, noted in Comments

## Boundaries

- Staging host: see the staging-host reference (http://172.23.10.110:4321). Never submit or write anything; the page is read-only.
- The 488 history applies: an old-build SIS.Api writing the day stats breaks parity (BackOffice 2644). Confirm the build first.

## Done when

The live drive is green on staging, parity and the spot-checks are recorded under Comments, and any drift is reconciled in the model, stub and drive.

## Blocked by

- [812](812-the-headline-strip-shows-the-six-server-figures-and-their-change.md), [813](813-choosing-a-courier-narrows-the-page-to-its-home-deliveries.md), [814](814-the-funnels-show-stage-drop-off-and-the-delivery-slot-split.md), [815](815-the-chart-is-drawn-by-core-charts-and-dims-while-today-refreshes.md), [816](816-the-store-tables-delivery-view-ranks-stores-by-slot-keeping.md)
- **External:** BackOffice spec [3404](file:///C:/Work/DMSCO/BackOffice/.issues/3404-the-web-statistics-door-scopes-by-courier-and-carries-slot-keeping-trips-delivery-time-and-the-previous-period-spec.md) (the brief for spec 811, filed 2026-11-06, draft) grilled, built and deployed to staging.

## Open questions

- ~~The BackOffice brief is not filed yet.~~ Filed 2026-11-06 as BackOffice spec 3404 (draft). Its ⚠ items (courier key on `SdStoreDayStat`, trips shared by two couriers, Today's hourly cut-off, the 62-day look-back for a 31-day Range) are BackOffice's to rule; reconcile here when they do.
