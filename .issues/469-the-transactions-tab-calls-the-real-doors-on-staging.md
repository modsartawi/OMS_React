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

## Comments

**2026-10-12 — live run on staging (BackOffice 2587–2589 deployed), store P237.** 69/69 green, no drift.

How it ran: the owner signed in through the proxy (`SIS_API=http://172.23.27.111:8099`, vite :5250).
The drive's door checks ran from inside that signed-in tab, with the same assertions as `sync-console-live-drive.mjs`.
The Playwright script itself did not run, because the session cookie is HttpOnly and stays in the browser.

- **Reads, 39/39.**
  - Today: 27 sales, 0 returns, 1,918.370, last completed 09:04:29. Envelope and row keys match the contract.
    Rows are ordered newest first. sales + returns = total, and lastCompletedAt is the newest row.
  - Yesterday (2026-10-11): 183 sales, 1 return, 20,712.570. It was read whole, page by page, and the rows
    add up to the summary.
  - notYet 0 = Agreement `missingAtCounter` 0, with the same receipts. mismatches 0 = `totalMismatches` 0.
  - Filters: counter, kind=sale / RETURN, status=voided (0) and status=all (184). notYet and mismatches stay
    COMPLETED-only. A receipt search finds the receipt and does not narrow the summary.
- **Refusals, 15/15.**
  - Transactions: BAD_PAGING, BAD_FILTER ×3, BAD_DATE ×3 (D-8, tomorrow, malformed) and NO_STORE.
  - The order BAD_PAGING → BAD_FILTER → BAD_DATE → NO_STORE holds.
  - Snapshot: BAD_REQUEST, NO_STORE and NOT_FOUND.
  - The WPF store P002 answers available with 0 rows.
- **Snapshot (one audited view, owner-approved), all green.**
  - Opened receipt 23724630699114 from the tab. The answer has auditId, receiptNumber and loadedAt, and
    `snapshot` is an object with 20 keys.
  - The drawer title is the receipt number, with 20 sections (one per key). Close removes the drawer.
  - The audit row (`TransactionSnapshotView`, codes [P237]) is in the feed, and the Audit screen shows
    "Viewed receipt JSON". The receipt's content was not printed.

Not covered here; they stay in the owner walk:
- the hand `[POS]` count and the per-receipt `RetailTrx` check;
- View JSON absent for a viewer;
- a new till sale appearing within about a minute.
