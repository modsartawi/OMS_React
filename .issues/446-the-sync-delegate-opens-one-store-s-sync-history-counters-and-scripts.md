---
status: done
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

- [x] `hourCellLegend`: every `HourCell` maps to a colour token and a label; unknown → noData (vitest).
- [x] `passesFromBound`: the date picker cannot go past 30 days (vitest).
- [x] `storeTabs(row)`: a WPF store gets only Counters and Passes (vitest).
- [x] `tools/sync-console-store-drive.mjs`: with stubs, the strip, every tab, the pass detail, the WPF reduced view and the NO_STORE state.
- [x] `npm run typecheck`, `npm run lint` and `npm test` green.

## Boundaries

oms-react only. The BackOffice side (BackOffice 2539) is built in parallel; until it lands, prove the screen
against stubs of the contract.

## Done when

The named helpers and the drive are green.

## Blocked by

[445](445-the-sync-delegate-sees-the-fleet-s-sync-health-on-one-page.md)

## Comments

**Done 2026-10-09 (AFK, resumed after a killed session).** The Store page at `/admin/sync/store/:code`
is built in `src/features/admin/sync-console/`: `StorePage`, `StoreHeader`, `StoreHealth`, `HourStrip`,
`StoreTabs`, `CountersTab`, `PassesTab` (+ `PassDetailModal`), `ScriptsTab`, `LocationTab`, `TabGrid`,
`store-columns`, `console-columns` (column defaults now shared with the Fleet table), `CodeBadgeView`,
`Loading`, and the pure `store-helpers.ts`. The store reads join the one model file
`src/core/models/sync-console.ts` (`StoreDetail`, `StoreHour(s)`, `StoreCounter(s)`, `StorePass`,
`PassDetail(Line)`, `StoreScript(s)`, `StoreLocation`, field for field with the contract). Commands
(448) and Audit (447) are placeholders. No control is rendered in this slice.

Proof:
- **vitest:** `store-helpers.test.ts`, 21 tests. They cover `hourCellLegend` (every cell → a token
  swatch and an existing label; unknown → noData), `passesFromBound` + `clampPassesFrom` (30 days from
  the LOCAL date, month/year crossings, an older pick pulled back), `storeTabs` (WPF → Counters and
  Passes only), `resolveStoreTab`, the pass/line/host/script badges.
- **drive:** `tools/sync-console-store-drive.mjs`, **65/65**, against STUBBED contract envelopes on
  vite :5199: header and pending badge, health, the strip (24 cells, unknown → noData, five colours,
  legend), every tab, Passes bounded/paged at 50/opening its detail, Scripts read-only, Location without
  credentials, `?tab=` across a reload, a failed refresh (stale health hidden, last strip and open tab
  kept), the WPF reduced view, and `NO_STORE` (asked once, neither retried nor polled). The fleet drive
  still passes 38/38.
- **Gates:** `typecheck` clean, `npm test` 230 files and 4199 tests, `lint` four gates clean, `build` green.

Reviews: `/code-review` (medium) returned 10 findings, all fixed: the strip keeps its last good answer
under a failed refresh and shows a loading line; the Passes bound follows the calendar past midnight;
`getRowId` is stable; `NO_STORE` stops the 30 s poll; the pass button is named by its visible time; an
unknown host is isolated through `CodeBadgeView`; Passes clamps an emptied page like the Fleet table;
one loading component. `/standards-review` found no hard violations; I applied the shared column
defaults and the `CodeBadge` script badge, and trimmed two sentences that claimed behaviour the
contract does not state (script retry, where credentials come from). The rest are logged in
`.afk/HITL-446.md` (30-day bound contract gap, WPF without strip, store-page refresh, `?tab=`, hour
colours, script words, extra loop facts).

Outstanding, not AFK-able: the live walk against BackOffice 2539 (ticket 450), and an owner eye on the
page against the prototype.
