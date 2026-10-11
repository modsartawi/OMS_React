---
status: open
spec: 444
blocked-by: 467
---

# 468 — An operator opens a receipt's JSON from the Transactions tab

BackOffice spec 2586 decision 6, door 2589 (`GET ActionSync/Store/Transactions/Snapshot`).

## What to build

- A **View JSON** action on each Transactions row, shown only with `canOperate`. A Health.View-only user never
  sees it.
- It opens a drawer (side sheet) titled with the receipt number, holding the snapshot pretty-printed (2-space
  indent, monospace, `dir="ltr"` even in Arabic), with collapsible top-level sections (header, lines, tenders,
  …) and a **Copy JSON** button. "Loaded at" is shown, with a note that this is HQ's applied copy, not the
  till's raw message.
- The snapshot is fetched only when the drawer opens, never prefetched, and not cached across opens (each open
  is an audited view).
- Refusals: `NOT_FOUND` reads "This receipt is no longer on the mirror for this store". `NO_STORE` and a 500 use
  the shared `failureLabelKey`.
- The audit feeds (fleet and store) label `TransactionSnapshotView` as "Viewed receipt JSON".

## Spine reach

UI → app (BackOffice door 2589, stubbed)

## Proof (→ `tdd` red-green cycles)

- [ ] `snapshotSections(json)`: splits the top-level keys in order, and a non-object comes back as one section
  (vitest).
- [ ] The audit label for `TransactionSnapshotView` (vitest, beside the existing audit-label tests).
- [ ] Store drive: the action is hidden read-only. With Operate it opens the drawer, shows the JSON, Copy works,
  and `NOT_FOUND` shows its words. Two opens make two requests.
- [ ] Gates green.

## Boundaries

oms-react only. The JSON may carry customer and loyalty data: no `console.log` of it, and no persisting it to
storage.

## Done when

The helpers and the drive sections are green.

## Blocked by

[467](467-the-store-page-s-transactions-tab-lists-a-day-s-newpos-receipts-with-their-counter-flag.md)
(live: BackOffice 2589).
