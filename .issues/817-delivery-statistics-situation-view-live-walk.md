---
status: done
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

- [x] live drive green against staging, all couriers and FarEye · flow (Playwright, live)
- [x] parity recorded: the till's and the web's shared figures agree for one store and one day · manual, noted in Comments
- [x] the three rule spot-checks recorded (two had no staging candidate — owed on production, below) with their delivery numbers · manual, noted in Comments

## Boundaries

- Staging host: see the staging-host reference (http://172.23.10.110:4321). Never submit or write anything; the page is read-only.
- The 488 history applies: an old-build SIS.Api writing the day stats breaks parity (BackOffice 2644). Confirm the build first.

## Done when

The live drive is green on staging, parity and the spot-checks are recorded under Comments, and any drift is reconciled in the model, stub and drive.

## Blocked by

- [812](812-the-headline-strip-shows-the-six-server-figures-and-their-change.md), [813](813-choosing-a-courier-narrows-the-page-to-its-home-deliveries.md), [814](814-the-funnels-show-stage-drop-off-and-the-delivery-slot-split.md), [815](815-the-chart-is-drawn-by-core-charts-and-dims-while-today-refreshes.md), [816](816-the-store-tables-delivery-view-ranks-stores-by-slot-keeping.md)
- **External:** BackOffice spec [3404](file:///C:/Work/DMSCO/BackOffice/.issues/3404-the-web-statistics-door-scopes-by-courier-and-carries-slot-keeping-trips-delivery-time-and-the-previous-period-spec.md) deployed to staging. It is ruled and built (tickets 3405–3407, merged into BackOffice `pricing2` at `de924e1af` on 2026-11-06), but **not deployed yet**. Run its deploy order on staging first: SQL `078`, then the build, then the `054` rebuild. Wait for the rebuild to finish. The hand-off brief's "What to check" section has the read-only query for that.

## Open questions

- ~~The BackOffice brief is not filed yet.~~ Filed 2026-11-06 as BackOffice spec 3404 (draft). Its ⚠ items (courier key on `SdStoreDayStat`, trips shared by two couriers, Today's hourly cut-off, the 62-day look-back for a 31-day Range) are BackOffice's to rule; reconcile here when they do.
- ~~BackOffice has not ruled the ⚠ items.~~ **Ruled and built 2026-11-06.** Reconcile against the hand-off brief
  [3404-oms-react-situation-view-brief.md](file:///C:/Work/DMSCO/BackOffice/.issues/assets/3404-oms-react-situation-view-brief.md).
  It has:
  - the final wire;
  - the absent-vs-null rules;
  - the rulings (its "Status for 817" table answers the four ⚠ items above);
  - a drift table against spec 811's proposal;
  - how the dates look on the wire;
  - what to check live: the rebuild check, the till parity table, and read-only queries to find the
    deliveries for the three spot-checks.
- **Known server issue, not web drift:** on days with callout deliveries, `stores[]` can carry a
  `storeCode: ""` row (Came in only). The till door refuses that row, so the parity step must skip it. It is
  BackOffice ticket 3429, which is open and waiting on an owner ruling. How the page labels it is this
  side's choice.

## Comments

### Live walk, 2026-11-07 (staging SIS.Api http://172.23.10.110:4433) — DONE

- **Deploy confirmed.** The 3405–3407 build is on staging (every 3404 member on the wire). SQL 078 + 054 run by the owner;
  the rebuild was confirmed finished on the staging DB (`SdStoreDayStatRun` holds only `SdStoreDayStat`, LastRunTime
  2026-11-07 01:03; no `SdStoreStatRebuild` row).
- **Live drive green: 118/118** (`tools/delivery-statistics-live-drive.mjs`, rewritten for 811 in 53fd6867):
  contract members; totals = Σ store rows (flow, misses, each track, slot counts); In slot + Out of slot + No slot =
  Delivered for Yesterday 3, 7 days 11, 31 days 41; shares only when judged; Delivered per trip null with no trips;
  the previous windows (Today → 2026-10-31 to 01:00, Yesterday → 2026-10-30, 7 days ending yesterday → 10-24…10-30,
  ending today → 10-25…10-31 with `until`, 31 days → 09-06…10-06 with all 6 figures); `changePct` absent exactly at
  value 0; each of FREY/OTOX/SMSA/SLNK/DAWA ≤ all couriers, no pick-up under a courier, none counted twice; `XXXX` →
  `SDD-02132` in the server's words on the page; case-insensitive code; the page's six headline figures and funnel
  stages equal the server's for all couriers, FarEye and 31 days; courier caption + no Pick-up funnel under FarEye;
  32-day guard (no call; door `SDD-02131`); no page errors.
  Before the rebuild finished the drive read 114/118 then 110/111 — the expected pre-/mid-rebuild states (no slot rows
  on old days; every `previous` figure absent while the rebuild row existed), not drift.
- **Drift reconciled** (BO hand-off brief `C:\Work\DMSCO\BackOffice\.issues\assets\3404-oms-react-situation-view-brief.md`):
  - `changePct` is percent units (25 = +25%), not 0–1 → `headline.ts` rescales to the tile's fraction (ff4256e9);
  - `until` / `previous.from` / `previous.to` are local wall-clock datetimes → the compared window names its days and
    the HH:mm, read as text (ff4256e9, 53fd6867 — live it had read "vs 2026-10-31T00:00:00 to 01:00");
  - a blank-`storeCode` callout row (BO 3429) is named "Unassigned (callout)" in the store table (ff4256e9).
  - Stub and stubbed drive moved to the real wire forms; stubbed drive 378/378.
- **Till parity: matches** (owner, 2026-11-07) — store **BZ02**, **2026-11-06**, all couriers, churned refills left
  out: Came in 0 · Made ready 0 · Out 0 · Trips 0 · Delivered 3 · Picked up 0 · Handed over 3 · misses all 0 · Delivery
  track 0/0/0/0 trips/3 · Pick-up track 0/0/0. Avg hand-over not compared (817 ruling).
- **Spot-checks** (read-only SQL from the brief, widened to 31 days, run by the owner on staging DB `POS`):
  1. scheduled evening delivery timed from the slot's start — **no candidate on staging** (no slotted delivery in 31
     days; every delivery judged is No slot);
  2. early delivery in slot at 0 min — **no candidate on staging** (same reason);
  3. pick-up carrying the FarEye default — **8000008195** (P001, entered 2026-11-06 12:22, `CourierCode` FREY):
     all couriers → Came in 1, Pick-up Came in 1, Pick-up funnel drawn with 1; `Courier=FREY` → all 0, Pick-up funnel not
     drawn. **Pass.**
  **Owed:** checks 1 and 2 have never met real slotted data; repeat them on the first production walk.
- **Noted, not fixed:** under an unknown courier the caption still names it ("These figures are XXXX's home
  deliveries only") above the server's refusal — cosmetic, unruled.
