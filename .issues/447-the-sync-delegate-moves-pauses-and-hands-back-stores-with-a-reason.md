---
status: open
spec: 444
blocked-by: 446
---

# 447 — The sync delegate moves, pauses and hands back stores, each with a reason

## What to build

The lasting controls and the audit trail:

- **One reason dialog** shared by every control. The reason is required and the confirm button
  stays disabled until it is filled.
- **Store page controls by host and grant:**
  - a worker store offers Pause/Resume and Hand back;
  - a WPF store offers only Move to worker;
  - without `canOperate`, no controls render.
- **Fleet bulk:** a row selection capped at 50 drives Move, Hand back, Pause and Resume in one
  call. The results come back per row; failures are listed with their code, and successes refetch.
- **Pending badge:** after a control, the store shows "pending" until `controlPending` clears on
  refetch.
- **Feeds:** the Audit tab on the Store page, and the fleet-wide **Audit** page
  (`/admin/sync/audit`, filters from/to/who/code). Each entry shows who, when, the action, the
  stores or batch, before → after, and the reason.
- Refusals (`TOO_MANY_STORES`, `REASON_REQUIRED`, `NOT_ON_WORKER`, `NO_STORE`) show through
  `apiErrorMessage`/`apiErrorCode`.

The wire shapes come from the door contract, `C:\Work\DMSCO\BackOffice\.issues\assets\2523-sync-console-door-contract.md`. The layout comes from the
[prototype](https://claude.ai/artifact/557hsB6V9zt9zV1XVrZPVd).

## Spine reach

UI → app (BackOffice control door, audit door)

## Proof (→ `tdd` red-green cycles)

- [ ] `allowedControls(row, access)`: exact sets for worker, paused worker, WPF, and no operate grant (vitest).
- [ ] `selectionCap`: the 51st selection is refused with a message key (vitest).
- [ ] `controlResultSummary`: per-row results become one toast sentence plus a failure list (vitest).
- [ ] `tools/sync-console-controls-drive.mjs`: with stubs, a single pause with a reason, bulk move of 3, a refused row shown, the pending badge, and the audit feed filters.
- [ ] `npm run typecheck`, `npm run lint` and `npm test` green.

## Boundaries

oms-react only. The BackOffice side (BackOffice 2539, 2540) is built in parallel; until it lands, prove the screen
against stubs of the contract.

## Done when

The named helpers and the drive are green.

## Blocked by

[446](446-the-sync-delegate-opens-one-store-s-sync-history-counters-and-scripts.md)
