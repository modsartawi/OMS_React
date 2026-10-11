---
status: open
spec: 444
blocked-by: 467, 468
---

# 469 — The Transactions tab calls the real doors on staging

BackOffice spec 2586. The live counterpart of 467–468, as 460 was for the mirror lane.

## What to build

- **Live drive.** Extend `tools/sync-console-live-drive.mjs` to `Store/Transactions` and
  `Store/Transactions/Snapshot` on staging (OMS-HQ SIS.Api, `172.23.27.111:8099`).
  - Fix any drift by **amending the contract first**
    (`C:\Work\DMSCO\BackOffice\.issues\assets\2523-sync-console-door-contract.md`), then both repos.
- **OWNER: the walk on staging (P237 or another pilot store).**
  - Today's list matches a hand query on `[POS]` (`PosTransactionHeader`, `StoreId`, `IsTraining = 0`, today).
    On 2026-10-11 P237 had 43 COMPLETED receipts by 11:23.
  - A receipt's counter badge matches whether its `RetailTrx` shadow exists, and yesterday's `notYet` rows equal
    the Agreement tab's `missingAtCounter` gaps for that day.
  - View JSON opens for an operator and is absent for a viewer. The view appears in the audit feed.
  - With the tab open on today, a new sale at the till appears within about a minute of reaching HQ.

## Spine reach

UI → app → SIS.Api → `[POS]` (live)

## Proof

- [ ] The live drive is green on staging.
- [ ] The owner walk is signed off under `## Comments`.

## Boundaries

Needs BackOffice 2587–2589 deployed on staging. Index 2590 is recommended first, but it is not required.

## Done when

The live drive is green and the owner walk is signed off.

## Blocked by

[467](467-the-store-page-s-transactions-tab-lists-a-day-s-newpos-receipts-with-their-counter-flag.md),
[468](468-an-operator-opens-a-receipt-s-json-from-the-transactions-tab.md)
(live: BackOffice 2587–2589 deployed).
