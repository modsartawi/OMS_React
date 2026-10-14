---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\assets\2641-oms-react-delivery-statistics-brief.md
blocked-by: 484, 485, 486, 487 (live: BackOffice 2639 + 2641 deployed and backfilled; parity: BackOffice 2644)
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

- [x] The live drive is green against staging. *(Run against PRODUCTION `172.23.27.111:8099` on the owner's call, 2026-10-13: 131/131.)*
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

## Comments

- 2026-10-13, live drive against **production** (`SIS_API=http://172.23.27.111:8099`, vite :5250, owner signed in
  through `SIS_SIGN_IN=window`): `tools/delivery-statistics-live-drive.mjs` **131/131**. Route, query and wire
  shape match the built door (`SdDocumentWebEndpoints.cs:123`); `api.ts` unchanged. Totals = Σ `stores[]` on every
  all-store read (677 stores today, 934 yesterday, 973 over 31 days); one store alone = its all-store row; the
  leave-outs only ever take away; the 32-day guard makes no call and the door answers `SDD-02131`; AsOf 0.5 min old.
  - Run 1's two drive faults (AG Grid virtualises rows → count off `aria-rowcount`; `LeaveOutTypes` compared as a
    set) were in the drive, not the page.
- **⚠ Parity NOT recorded — the server's own figures for a closed day moved.** P979, Yesterday (2026-10-12),
  churned left out, read 3 minutes apart:

  | Figure | run 1 (AsOf 10:34:27) | run 2 (AsOf 10:37:10) |
  |---|---|---|
  | Came in | 185 | 217 |
  | Made ready | 180 | 69 |
  | Out for delivery | 173 | 173 |
  | Trips | 177 | **0** |
  | Delivered / Picked up / Handed over | 155 / 8 / 163 | 155 / 8 / 163 |
  | Rescheduled / Close requested / Closed | 16 / 12 / 12 | 18 / 25 / 14 |
  | Avg hand-over (min) | 593.09 | 1,156.48 |

  Run 2 looks like the **pre-2639 rule** (no Trips, Made ready off `ORDY`/`XRDY`, orders in Came in and Close
  requested, hand-over from the order's entry), and the two AsOf stamps are under 5 minutes apart. Hypothesis, not
  verified: a second SIS.Api on the OLD build (the aggregator is `SdStoreStatsBackgroundService` inside SIS.Api)
  still ticks against the same HQ DB and rebuilds today + yesterday under the old rule, fighting the new one.
  BackOffice 2639 needs this found before parity means anything; re-run the drive and compare P979 across ticks.
- 2026-10-13, **confirmed** with the owner's queries on the HQ OMS DB. For P239 on 2026-10-12, `SdStoreDayStat` (what the
  doors read) has **no Trips row**, and MadeReady is 10, CameIn 141 and CloseRequested 21. 2639's own
  `SdStoreStatFirstEvent` says MadeReady **112**, CameIn **117** and CloseRequested **16**; every other metric agrees. So
  an old-build SIS.Api is still rebuilding today and yesterday under the pre-2639 rule. Filed as **BackOffice 2644**
  (`C:\Work\DMSCO\BackOffice\.issues\2644-an-old-build-sis-api-still-writes-store-statistics-under-the-old-rule.md`).
  Note that 2639/2641/2640 are still unpushed on BackOffice `pricing2`. Parity waits on 2644.
- 2026-10-13, owner feedback: the flow band read Delivered as a stage after Out for delivery. The page now follows the
  till. The stages are Came in → Made ready → Out for delivery → Handed over ("Delivered + picked up"). Delivered (home
  delivery, D) and Picked up (pick in store, P) sit apart, as "Handed over, by delivery type". The store table uses the
  same order. The stubbed drive passes 174/174. The server never mixed the two types (`SdStoreStatsAggregator.cs:206-209`).
