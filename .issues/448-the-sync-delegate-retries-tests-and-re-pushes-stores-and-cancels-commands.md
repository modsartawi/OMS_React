---
status: done
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

- [x] `rePushDateBounds(today)`: the minimum is the start of the 41-day window, and the default is that minimum (vitest).
- [x] `rePushPreviewSentence`: the per-store and total counts plus the effective date become one sentence (vitest).
- [x] `pollUntilTerminal`: stops on each terminal status and gives up after 60 s (vitest, fake timers).
- [x] `tools/sync-console-commands-drive.mjs`: with stubs, a connection test goes from testing… to OK and to error, a re-push preview then confirm, a cancel, and a duplicate refused.
- [x] `npm run typecheck`, `npm run lint` and `npm test` green.

## Boundaries

oms-react only. The BackOffice side (BackOffice 2539, 2540) is built in parallel; until it lands, prove the screen
against stubs of the contract.

## Done when

The named helpers and the drive are green.

## Blocked by

[447](447-the-sync-delegate-moves-pauses-and-hands-back-stores-with-a-reason.md)

## Comments

**Done 2026-10-09 (AFK).** Built in `src/features/admin/sync-console/`:
- **Model** (`@/core/models/sync-console`): `SyncCommand`, `SyncCommandRequest/Result/Response`,
  `RePushRequest/StoreResult/Response`, `CancelCommandsRequest/Result/Response`, `COMMAND_STATUSES`,
  `COMMAND_KINDS`, field for field with the contract. `api.ts` adds `commands`, `batch`,
  `sendCommand`, `rePush`, `cancelCommands` and `commandsQueryOptions` (key `COMMANDS_KEY`).
- **Pure helpers** in `command-helpers.ts`:
  - `allowedCommands` / `storeActions`: the control row in the prototype's order. A WPF store gets
    only Move to worker and Test connection; without `canOperate` it gets nothing.
  - `pollUntilTerminal` (2 s, until EVERY command of the batch is terminal or 60 s pass; a failed
    read or an empty answer is not a verdict) and `runVerdict`.
  - `rePushDateBounds` / `clampRePushFrom`: the 41-day window from today's LOCAL date, opening on
    its start.
  - `sameRePushInputs`: the preview's freshness.
  - `rePushPreviewSentence` (with `echoedDay`): the counts and the ECHOED date in one sentence.
  - `commandsQuery`, `commandStatusBadge`, `commandKindKey` and `canCancel`.
- **Store page** (`StoreControls`): Retry now, Pause/Resume, Re-push…, Test connection and Hand
  back on a worker store; Move to worker and Test connection on a WPF store.
  - `CommandDialog` posts the command behind the shared reason dialog.
  - `CommandRun` follows the command to "Testing…", then OK, or the flattened error, or "still
    running" after 60 s.
  - `DUPLICATE_PENDING` and `NOT_ON_WORKER` are listed with their codes, and nothing is polled.
- **`RePushDialog`** (store page, and the fleet's bulk bar with up to 50 stores via 447's
  selection):
  - scope is all objects or the chosen push objects;
  - the from-date is bounded to the window;
  - the reason is required;
  - Preview (`preview: true`) shows one sentence with per-store and total counts and the echoed
    date, plus the refused stores;
  - any changed input makes the preview stale and disables Confirm;
  - Confirm posts the previewed inputs with `preview: false`, and shows one toast with the batch.
- **Commands:**
  - `CommandsFeed` + `command-columns`, shared by the store's Commands tab (`CommandsTab`) and the
    new `/admin/sync/commands` page (`CommandsPage`), which filters on status, kind, batch and
    code;
  - paged by the door at 50;
  - Cancel on Pending rows only, with a reason; `NOT_PENDING` is listed;
  - `ConsoleNav` gains Commands.
- **447 code touched:**
  - `ReasonDialog` gained `confirmDisabled` and `extraAction` (Preview);
  - `ControlResults` and `resultSentence` take commands and cancels, and `notifyOutcome` is shared;
  - the dead `sentenceKey` was removed;
  - `StorePage` keeps the controls mounted on the last known row through a failed refresh.

Proof:
- **vitest:** `command-helpers.test.ts`, 27 tests:
  - `rePushDateBounds` (window start = default, local date, crossing a year, clamping);
  - `rePushPreviewSentence` (many / one / none, refused rows left out, echoed date never shifted);
  - `pollUntilTerminal` with fake timers (stops on each of Done / Failed / Cancelled / Expired;
    waits for every command; asks every 2 s and gives up after 60 s with 30 reads; a blip or an
    empty answer is not a verdict; abort);
  - `storeActions`, `sameRePushInputs`, the badges, labels and sentence groups, and
    `commandsQuery`.
  - Full suite: **232 files, 4253 tests, all passing.**
- **drive:** `tools/sync-console-commands-drive.mjs`, **68/68**, against STUBBED contract envelopes
  on vite :5199:
  - a connection test goes from Testing… through Pending and Running polls to OK, and the poll
    stops;
  - another test goes to the flattened error;
  - Retry runs 30 reads and then reads "still running";
  - a duplicate is refused (`DUPLICATE_PENDING` listed, nothing polled);
  - a WPF store offers Move + Test only;
  - a store re-push: the window's start, Preview gated by the reason, a stale preview after a date
    change, chosen objects, Confirm re-posting the same inputs with `preview: false`, a toast with
    the batch, and the Commands tab;
  - a fleet re-push of 3: per-store and total counts, `NOT_ON_WORKER` listed;
  - the Commands page: filters, a cancel with a reason, `NOT_PENDING` refused, and view-only.
- **Regression drives**, all re-run green after their 448 updates: controls 67/67, store 65/65,
  fleet 38/38. The fleet drive's store-page stub was put in contract shape.
- `npm run typecheck`, `npm run lint` (all four gates) and `npm run build` are green.

**Reviews:**
- `/code-review`: 10 findings, all fixed:
  - controls unmounted by a failed refresh;
  - unused `Trans` slots;
  - the "Commands" wording on WPF stores;
  - fleet invalidation;
  - the action-count plural;
  - the untracked-command toast;
  - the separate preview error;
  - the dead `sentenceKey`;
  - `fsi` on a raw kind;
  - a redundant map.
- `/standards-review`: no hard violation and nothing missing. Fixed: the dead key, the duplicate
  "All push objects" key, and the repeated toast switch (`notifyOutcome`). The other judgement
  calls (shared result plumbing living in `ControlDialog.tsx`, the repeated invalidation block,
  the copied INPUT class) are left as they are.

**Owner sign-off wanted** (`.afk/HITL-448.md`):
- the chosen-objects list read from the first store's push counters (no door lists objects;
  contract gap);
- the 41-day window counted as today plus the 40 days before;
- the reason left out of the preview's freshness;
- bulk Re-push offered on WPF rows (as 447).

**Outstanding (not this ticket's to fake):** every proof is stubbed. The live walk against
BackOffice 2539/2540 on staging is ticket 450, as is an owner eye on the pages against the
prototype.
