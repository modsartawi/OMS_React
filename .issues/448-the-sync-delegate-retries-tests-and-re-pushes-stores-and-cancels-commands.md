---
status: open
spec: 444
blocked-by: 447
---

# 448 — The sync delegate retries, tests and re-pushes stores, and cancels commands

## What to build

The one-shot commands:

- **Retry now** (worker stores only) and **Test connection** (any store). Each posts
  `ActionSync/Commands`, then polls `Commands?batch=` every 2 s until the command is terminal (up
  to 60 s). The page shows "testing…", then OK or the flattened error.
- **Re-push dialog**, opened from one store or a fleet selection of up to 50:
  - scope: all objects, or chosen objects;
  - from-date: limited to the 41-day window and defaulting to its start;
  - a required reason;
  - a **preview call** that shows the replay count per store and in total, along with the effective
    date the server echoed;
  - a **confirm** that posts with `preview: false`.
- **Commands:** the Commands tab on the Store page, and the fleet-wide **Commands** page
  (`/admin/sync/commands`, filters status/batch/code/kind), with **Cancel** on a pending command
  (it needs a reason).
- Refusals: `DUPLICATE_PENDING`, `NOT_ON_WORKER` and `NOT_PENDING`.

The wire shapes come from the door contract, `C:\Work\DMSCO\BackOffice\.issues\assets\2523-sync-console-door-contract.md`. The layout comes from the
[prototype](https://claude.ai/artifact/557hsB6V9zt9zV1XVrZPVd).

## Spine reach

UI → app (BackOffice command doors)

## Proof (→ `tdd` red-green cycles)

- [ ] `rePushDateBounds(today)`: the minimum is the start of the 41-day window, and the default is that minimum (vitest).
- [ ] `rePushPreviewSentence`: the per-store and total counts plus the effective date become one sentence (vitest).
- [ ] `pollUntilTerminal`: stops on each terminal status and gives up after 60 s (vitest, fake timers).
- [ ] `tools/sync-console-commands-drive.mjs`: with stubs, a connection test goes from testing… to OK and to error, a re-push preview then confirm, a cancel, and a duplicate refused.
- [ ] `npm run typecheck`, `npm run lint` and `npm test` green.

## Boundaries

oms-react only. The BackOffice side (BackOffice 2539, 2540) is built in parallel; until it lands, prove the screen
against stubs of the contract.

## Done when

The named helpers and the drive are green.

## Blocked by

[447](447-the-sync-delegate-moves-pauses-and-hands-back-stores-with-a-reason.md)
