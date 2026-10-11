---
status: done
spec: 444
blocked-by: —
---

# 467 — The store page's Transactions tab lists a day's NewPos receipts with their counter flag

BackOffice spec 2586
(`C:\Work\DMSCO\BackOffice\.issues\2586-the-sync-console-lists-a-newpos-store-s-transactions-as-they-arrive-spec.md`),
doors 2587 and 2588. Contract: section "Today's transactions" in
`C:\Work\DMSCO\BackOffice\.issues\assets\2523-sync-console-door-contract.md`. Until the doors land, build against
stubs of the contract.

## What to build

On `/admin/sync/store/:code`, a **Transactions** tab appended after Agreement (worker and WPF stores alike):

- **Summary strip:** sales, returns, signed total (`formatMoney3`), last completed at, and "not yet on the
  counter rail" (plus mismatches when > 0, in the danger token).
- **Day picker:** today (default) back to D-`AgreementWindowDays`. Only those days are offered, so `BAD_DATE` is
  unreachable from the UI.
- **List** (`TabGrid`, paged by the door at 50): receipt, register, operator, status, sale/return, signed total,
  opened at, completed at, and a **counter badge** (`arrived` ok / `notYet` warn / `mismatch` bad, with the
  counter total in the tooltip).
- **Filters:** status (Completed default / Voided / All), kind, counter flag, and an exact receipt search.
- **Poll** every 60 s only while the tab is open on **today**. A past day never polls. The tab strip's Refresh
  works as for every tab (`storeTabKey`).
- `available: false` shows "The mirror is not reachable or not set up" and no list. A WPF store reads
  "No NewPos receipts".
- The list rows keep `transactionId` (468 opens the JSON with it).

## Spine reach

UI → app (BackOffice doors, stubbed)

## Proof (→ `tdd` red-green cycles)

- [x] `counterBadge`: every flag gets a label and a token, and an unknown one shows raw (vitest).
- [x] `transactionsQuery(day, filters, page)`: builds the door query, and omits defaults (vitest).
- [x] `pollsToday(day, today)`: true only for today (vitest).
- [x] A store drive section: the tab is listed, the summary renders, day → list, each filter, receipt search,
  paging, `available: false`, the WPF store, and polling on today only (Playwright, `page.route` stubs).
- [x] The tab-list assertions in the existing store drive are updated (Transactions after Agreement), and every
  other assertion is unchanged.
- [x] Gates green: typecheck, lint, vitest, build.

## Boundaries

oms-react only. Read-only, so it is visible with `ActionSync.Health.View`.

## Done when

The helpers and the extended store drive are green.

## Blocked by

None. It can start immediately against stubs (live: BackOffice 2587, 2588).

## Comments

- 2026-10-11 (AFK): **done**. Every proof is stubbed, because BackOffice 2587 and 2588 are not built yet. Nothing here was driven against a live SIS.Api.
  - **Model** (`@/core/models/sync-console`, the whole contract section, so 468 builds on it): `TxStatusFilter`, `TxKindFilter`, `CounterFlag` (with `TX_STATUS_FILTERS`, `TX_KIND_FILTERS`, `COUNTER_FLAGS`), `StoreTransaction`, `StoreTransactionsSummary`, `StoreTransactions`, `StoreTransactionSnapshot` (`snapshot: unknown`), and `TransactionSnapshotView` in `AuditAction`. `AUDIT_ACTIONS` is a `Record<AuditAction, …>`, so adding the action forced its label in this slice: "Viewed receipt JSON", plus the existing `auditActionKey` test list. 468 finds it done.
  - **Tab:** `transactions` is appended after `agreement` in `STORE_TABS` (nine) and `WPF_TABS` (five). `TransactionsTab` is mounted only while open, as every tab is.
    - A WPF store shows "No NewPos receipts…" and sends no request.
    - `available: false` shows "The mirror is not reachable or not set up…" with no summary, list or pager.
    - Otherwise the tab draws the door's summary of the day it served (`data.day`): sales, returns, signed total (`formatMoney3`), last completed (or "None yet"), not yet on the counter rail, and mismatches only when > 0 (`text-danger-800`). Below it is the `TabGrid` list, paged by the door at 50.
  - **List:** receipt, register, operator, status, sale or return, signed total (as the door signed it), opened, completed, and the counter badge. The badge uses `counterBadge`: arrived is go, not yet is warn, mismatch is bad, and an unknown flag shows raw and neutral. Its tooltip is the counter total, isolated once with `fsi`, or its own not-yet words. Rows are keyed by `transactionId`, which is not a column.
  - **Filters:**
    - The day picker offers today and the 7 days before it (`transactionDays`, one constant `TRANSACTIONS_WINDOW_DAYS`).
    - Status, kind and counter flag each ask the door from page 1.
    - The exact receipt search asks on Enter or Search only, and Clear empties it.
    - `transactionsQuery` always sends the day and leaves out the door's defaults. `status=all` is sent.
  - **Poll:** the query key sits under `storeTabKey(code, 'transactions')`, so the tab's Refresh re-reads it. `refetchInterval` is `transactionsPollInterval(day, new Date())`, judged at each tick: 60 s on today and never on a past day.
  - **Changed on purpose:** only the store drive's four tab-list checks (sections 3, 7, 11, 12b; Transactions after Agreement) and the matching `store-helpers.test.ts` tab tests. Every other existing assertion is unchanged.
  - **Proof:**
    - vitest: `transactions-helpers.test.ts` (new) covers `counterBadge`, `counterTip`, `localToday`, `transactionDays`, `pollsToday`, `transactionsPollInterval`, `transactionsQuery`, the filter words, `txStatusLabel` and `txKindLabel`. Full suite: 254 files, 4570 tests passing.
    - Store drive (`DRIVE_PORT=5197`): 251/251, which is the 185 existing checks plus 66 new. The new sections are:
      - **16:** the tab, the day picker, the summary, the list and its badges and tooltips, paging, Refresh, each filter, the receipt search, a past day and an empty day.
      - **17:** polling with `page.clock` at the real 60 s. Today re-reads, a past day never does, and a closed tab never does.
      - **18:** `available: false`, and a WPF store with a request counter of 0.
    - Controls drive: 110/110.
    - Typecheck, all four lint gates and the build pass.
  - **Outstanding (not AFK's to do):**
    - a human's eye on the Transactions tab (no prototype covers it);
    - the live doors (ticket 469).
  - Decisions and the contract gap (the door does not expose `AgreementWindowDays`) are logged in `.afk/HITL-467.md`.
