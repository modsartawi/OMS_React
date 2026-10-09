---
status: open
spec: 444
blocked-by: 445
---

# 446 — The sync delegate opens one store's sync history, counters and scripts

## What to build

The Store page at `/admin/sync/store/:code`:

- **Header:** host, state badges, and the pending badge (`controlPending`).
- **Health summary:** reachable and backoff, push lag with the oldest pending action, last trx
  pulled, last error per loop.
- **24 h strip** from `Store/Hours`, with a colour legend over the five `HourCell` values.
- **Tabs:**
  - **Counters:** object, bound, counter, log head, lag, oldest pending.
  - **Passes:** paged, `from` limited to 30 days. Clicking a pass opens its detail from
    `Store/PassDetail`.
  - **Scripts:** read only, the script id and never SQL.
  - **Location:** no credentials.

  The Commands and Audit tabs are left as placeholders for 447.
- **A WPF store** (no health row) shows only Counters and Passes, with a note that it is still
  synced by WPF.
- A 404 `NO_STORE` shows a "no such store" state, not a crash.

The wire shapes come from the door contract, `C:\Work\DMSCO\BackOffice\.issues\assets\2523-sync-console-door-contract.md`. The layout comes from the
[prototype](https://claude.ai/artifact/557hsB6V9zt9zV1XVrZPVd).

## Spine reach

UI → app (BackOffice read doors)

## Proof (→ `tdd` red-green cycles)

- [ ] `hourCellLegend`: every `HourCell` maps to a colour token and a label; unknown → noData (vitest).
- [ ] `passesFromBound`: the date picker cannot go past 30 days (vitest).
- [ ] `storeTabs(row)`: a WPF store gets only Counters and Passes (vitest).
- [ ] `tools/sync-console-store-drive.mjs`: with stubs, the strip, every tab, the pass detail, the WPF reduced view and the NO_STORE state.
- [ ] `npm run typecheck`, `npm run lint` and `npm test` green.

## Boundaries

oms-react only. The BackOffice side (BackOffice 2539) is built in parallel; until it lands, prove the screen
against stubs of the contract.

## Done when

The named helpers and the drive are green.

## Blocked by

[445](445-the-sync-delegate-sees-the-fleet-s-sync-health-on-one-page.md)
