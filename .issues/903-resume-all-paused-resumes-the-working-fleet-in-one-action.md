---
status: done
spec: BackOffice 3913
blocked-by: BO 3916, BO 3917
---

# 903 — "Resume all paused…" resumes the working fleet in one action

## What to build

BackOffice spec 3913, "Resume all paused" (doors: BackOffice 3917's `GET ActionSync/Stores/Paused`, BackOffice 3916's
bulk door).

- **The button.** "Resume all paused…" on the Fleet page, shown with `canOperate`.
- **The preview.** It lists every paused, non-disabled worker store (disabled stores never appear) with:
  - code and description;
  - who paused it, when, and the reason (a DataSync campaign's tag shows as written).

  Every row is **ticked**. The operator unticks stores to leave paused, and can tick or untick all.
- **The send.** A reason, then confirm. The ticked codes go through the **bulk door**. The per-store results are listed,
  and the fleet, store pages and audit refetch.
- **Empty case.** No paused stores: the button shows the dialog's empty state, never an error.
- Both languages for every new string.

## Spine reach

UI (Resume-all dialog, api)

## Proof (→ `tdd` red-green cycles)

- [x] `resumeAll_startsAllTicked_untickKeepsPaused` · control-helpers.test.ts
- [x] `resumeAll_sendsTickedCodesToBulkDoor_withReason` · control-helpers.test.ts
- [x] `resumeAll_emptyPreview_isEmptyState` · control-helpers.test.ts

## Boundaries

—

## Done when

The proofs are green, and a staging walk resumes more than 50 paused stores in one confirm while a disabled store stays
disabled.

## Blocked by

BackOffice 3916, BackOffice 3917

## Comments

**2026-11-16, implementer (branch `ticket/3913-903`, worktree `C:\Playground\oms-react-t903`), commit `09b349d2`**
(on `spec/3913-disabled-stores` at `072ca59f`; the spec tip had not moved, nothing to merge). Built against stubs:
BackOffice 3916/3917 are unbuilt and the 2523 contract is not amended, so the shapes come from 3913/3917.

- **Button** "Resume all paused…" on the Fleet page, with `canOperate`, in the active view only (not in the
  disabled view, which offers only Enable).
- **Dialog** `ResumeAllDialog.tsx` (on the shared `ReasonDialog`): reads `GET ActionSync/Stores/Paused`
  (`syncConsoleApi.pausedStores`) fresh on each opening. Each row shows code · description, who paused it, when,
  and the reason as written (a DataSync tag is not reworded). A pause with no stamp reads "Not recorded". Every row
  starts ticked; there is a tick-all box with a mixed state; the summary reads "n of m … ticked"; the Confirm label
  counts the ticked stores. No paused store shows the empty state (no error), with Confirm off. A failed read says so.
- **Send**: one Resume with the ticked codes, in preview order, and the trimmed reason, through 902's
  `syncConsoleApi.controlBulk`. It **always** goes to the bulk door, even for a few stores. The toast names the
  batch, `ControlResults` lists the refusals (`DISABLED` included), and the fleet, every store page and the audit
  refetch.
- **Pure** (`control-helpers.ts`): `resumeAllTicks`, `toggleResumeTick`, `tickAllResume`, `resumeAllRequest`
  (`null` with nothing ticked or a blank reason), `resumeAllView` (`empty` | `list` with all/some/none).
  Model `PausedStore`.
- en + ar for every new string (ar plural forms for the Confirm count).
- **Tests**: the 3 proofs + en/ar key and slot parity; whole suite 777 files / 10,722 tests green; typecheck clean;
  lint gates grid-base, contrast, palette, controls clean (boundaries: only the known insurance-rules failures).
- **Drive** `tools/sync-console-resume-all-drive.mjs`, stubbed: **46/46**. It resumes 119 of 120 paused stores in
  one bulk POST, leaves one store paused by unticking it, and keeps the 3 disabled stores out. Re-run: select-all
  39/39, disabled 63/63, fleet 87/88 (the known menu-order check), controls 113/113. Two earlier controls runs failed
  one-off, different checks each time (section 5's ticks, section 8's dead-letter count, which this slice does not
  touch). Load timing, not this change.

**Contract guesses (check against 3917 when it lands):**
1. `Stores/Paused` answers `{ stores: [...] }`; a bare array is read too.
2. Row keys `code`, `description`, `pausedBy`, `pausedAt`, `pauseReason` (3913's names for the row fields), each
   nullable for a pause made before 3914 stamped them. The door's order (`pausedAt`) is kept, not re-sorted.

**Judgement calls:**
- The send uses the bulk door whatever the count (the ticket says "through the bulk door"), not `sendControl`'s
  size routing.
- The chunk size in the note is `SELECTION_CAP` (50), the same figure as 902's bulk note.
- Not offered in the disabled view.

**Owed:** the staging walk on BO 3916 + 3917: resume more than 50 paused stores in one confirm while a disabled store
stays disabled.
