---
status: open
spec: BackOffice 3202 (D14: the screen lives in this console); doors BackOffice 3203, 3207
blocked-by: BackOffice 3207
---

# 663 — The sync delegate sees sent store scripts and each store's state on the Scripts page

## What to build

- **Scripts page** at `/admin/sync/scripts`, a `ConsoleNav` entry after Objects (a read: `ActionSync.Health.View`).
  - Reads `GET ActionSync/Scripts`. One row per script: title ("untitled (legacy)" for a legacy one), sender, sent
    at, target (all / chosen), store count, and the counts executed / pending / retrying / exhausted / withdrawn.
  - Opening a script reads `GET ActionSync/Scripts/Detail`: per store, its code, description, state, attempts, last
    attempt and last error. The SQL is shown read-only when the door returns it (grant holders only), and never
    otherwise.
- **Store page → Scripts tab** shows the new `title`, `attempts`, `state` and `createdAt` (blank for legacy).
- The labels follow `CONTEXT.md`: "store script", and "exhausted" for a store that used up its attempts.

## Spine reach

ui · api client · test · drive (stubbed)

## Proof (→ `tdd` red-green cycles)

- [ ] `scripts-helpers.test.ts`: the state counts' labels, the legacy title, and the detail's state ordering
      (exhausted first)
- [ ] `tools/sync-console-scripts-drive.mjs` (stubbed): the list, the detail, SQL absent when the door sends `null`,
      and the store page's Scripts tab fields
- [ ] `npm run typecheck`, `npm test`, `npm run lint`

## Boundaries

No controls here: Send, Withdraw and Retry are 664.

## Done when

The proofs above hold.

## Blocked by

BackOffice [3207](C:/Work/DMSCO/BackOffice/.issues/3207-the-console-lists-sent-store-scripts-with-their-state-counts-and-only-a-grant-holder-reads-the-sql.md)
