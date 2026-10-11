---
status: open
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

- [ ] `counterBadge`: every flag gets a label and a token, and an unknown one shows raw (vitest).
- [ ] `transactionsQuery(day, filters, page)`: builds the door query, and omits defaults (vitest).
- [ ] `pollsToday(day, today)`: true only for today (vitest).
- [ ] A store drive section: the tab is listed, the summary renders, day → list, each filter, receipt search,
  paging, `available: false`, the WPF store, and polling on today only (Playwright, `page.route` stubs).
- [ ] The tab-list assertions in the existing store drive are updated (Transactions after Agreement), and every
  other assertion is unchanged.
- [ ] Gates green: typecheck, lint, vitest, build.

## Boundaries

oms-react only. Read-only, so it is visible with `ActionSync.Health.View`.

## Done when

The helpers and the extended store drive are green.

## Blocked by

None. It can start immediately against stubs (live: BackOffice 2587, 2588).
