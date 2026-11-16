---
status: done
spec: BackOffice 3913
blocked-by: BO 3914
---

# 900 — The operator disables and enables stores, and disabled stores hide behind "Show disabled (N)"

## What to build

Store sync console, BackOffice spec 3913 (doors: BackOffice 3914; contract: the sync console door contract, as amended
by 3914). A **disabled store** is out of operation; Enable returns it to **paused** (BackOffice `CONTEXT.md`).

- **Model.** Mirror the amended contract:
  - the `disabled` state;
  - the `Disable` / `Enable` actions;
  - the `DISABLED` / `NOT_DISABLED` failure labels;
  - `isDisabled` and the paused/disabled who/when/why fields on `StoreRow`;
  - the Summary's disabled count;
  - the `Disable` / `Enable` audit actions.
- **Controls.**
  - `allowedControls`: a disabled worker store offers **only Enable**. An active worker store offers Pause or Resume,
    Disable, then Hand back.
  - The store page shows "Disabled by … on … — reason" on a disabled store.
- **Fleet.**
  - The list, tiles and counts are the door's default, so disabled stores are hidden.
  - A **"Show disabled (N)"** toggle (N = the Summary's count) switches to `disabled=only`, a view of only the disabled
    stores.
  - The bulk bar offers Disable in the normal view and only Enable in the disabled view, so a selection never mixes the
    two.
  - Switching views clears the selection.
- Disable goes through the existing reason dialog for now. 901 adds the warning table.
- **Text.** Both languages (en/ar) for every new string.

## Spine reach

UI (model, helpers, Fleet page, store page, audit labels)

## Proof (→ `tdd` red-green cycles)

- [x] `allowedControls_disabledStore_offersOnlyEnable` / `_activeWorker_offersDisable` · control-helpers.test.ts
- [x] `bulkActions_perView`: Disable in the normal view, Enable only in the disabled view · control-helpers.test.ts
- [x] `fleetQuery_showDisabled_sendsDisabledOnly_andClearsSelection` · helpers.test.ts
- [x] `auditActionKey_knowsDisableEnable` · control-helpers.test.ts

## Boundaries

No flag. Build against stubs until BO 3914 lands, then walk it on staging.

## Done when

The proofs are green, and a staging walk shows: disable a store, it vanishes from the list, the toggle shows it, Enable
returns it paused.

## Blocked by

BackOffice 3914

## Comments

**2026-11-16, implementer (branch `ticket/3913-900`, worktree `C:\Playground\oms-react-t900`), commit `5f2adca8`.**
Built against stubs: BackOffice 3914 is unbuilt, and the 2523 door contract is **not amended yet**, so the shapes come
from 3913/3914.

- **Model** (`core/models/sync-console.ts`): `disabled` state, `Disable`/`Enable` control + audit actions,
  `DISABLED`/`NOT_DISABLED` labels, `isDisabled` + `disabledBy/At/disableReason` + `pausedBy/At/pauseReason` on
  `StoreRow`, all optional (a pre-3914 door reads as an active store).
- **Controls**: `allowedControls` gives a disabled store only Enable; an active worker store Pause/Resume, Disable,
  Hand back. `storeActions`/`allowedCommands` also drop every command on a disabled store (3913: commands refused
  `DISABLED`). The store header shows "Disabled by … on … — reason" (each value isolated).
- **Fleet**: "Show disabled (N)" toggles `disabled=only` (`fleetView`: tiles let go, page 1, selection emptied).
  `bulkActions(view)`: Move, Hand back, Pause, Resume, Re-push, Disable in the active view, only Enable in the
  disabled one. `disabled` has no tile.
- **Tests**: vitest 4 proofs + `storeActions` on a disabled store + ar key coverage; whole suite green.
- **Drive** `tools/sync-console-disabled-drive.mjs`, stubbed: **40/40**. The existing controls/commands drives now
  expect Disable in the store's control row.

**Contract guesses (check against 3914 when it lands):**
1. The Summary's disabled count is read from `counts.disabled` (3913 only says "the disabled count").
2. `disabled=only` goes only on `GET ActionSync/Fleet`. Summary and LastHour are always read at their default.
3. Field names as 3913 lists them: `isDisabled`, `disabledBy`, `disabledAt`, `disableReason`, `pausedBy`,
   `pausedAt`, `pauseReason`.

**Judgement calls:**
- The disabled view does not draw the tiles or the last-hour panel. They describe the active fleet, and a tile
  click there would filter a list it does not count.
- Arabic: the console had been English-only by ruling (2522 §3). A **partial** `ar/sync-console.json` now holds
  only the new words, registered on the data-sync precedent. `lng` is pinned to `en` app-wide, so the drive proves
  only the RTL layout; vitest proves the ar keys are present.

**Owed:** the staging walk on BO 3914 (disable a store, it leaves the list, the toggle shows it, Enable returns it paused).
