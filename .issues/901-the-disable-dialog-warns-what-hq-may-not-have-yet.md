---
status: done
spec: BackOffice 3913
blocked-by: 900, BO 3917
---

# 901 — The Disable dialog warns what HQ may not have yet

## What to build

BackOffice spec 3913, decision "Disable warns, then allows" (door: BackOffice 3917's `POST ActionSync/Stores/Disable/Preview`).
Before Disable is confirmed (one store, or a bulk selection), the dialog reads the preview and shows a table, one row
per store, with:

- last good connect;
- last push and pull outcome;
- last transaction pulled;
- pending actions;
- till backlog;
- open mirror dead letters;
- scripts still waiting.

The rows with anything outstanding are highlighted, with a one-line count at the top ("3 of 12 stores still hold work
HQ has not received").

The operator then gives a reason and confirms. **Nothing is refused**: an unreachable closed store can always be
disabled. Both languages for every new string.

## Spine reach

UI (Disable dialog, api)

## Proof (→ `tdd` red-green cycles)

- [x] `disableWarnings_flagsStoresWithOutstandingWork_countsThem` · control-helpers.test.ts
- [x] `disableWarnings_neverBlocksConfirm` · control-helpers.test.ts

## Boundaries

—

## Done when

The proofs are green, and a staging walk shows the table for a store with a backlog.

## Blocked by

900, BackOffice 3917

## Comments

**2026-11-16, implementer (branch `ticket/3913-901`, worktree `C:\Playground\oms-react-t901`), commit `5f694f9c`**
(on `spec/3913-disabled-stores` at `5f2adca8`; nothing new on the spec tip to merge). Built against a stub:
BackOffice 3917 is unbuilt and the 2523 contract is not amended, so the shapes come from 3913/3917.

- **api** `syncConsoleApi.disablePreview` → `POST ActionSync/Stores/Disable/Preview` `{codes}`.
- **Pure** (`control-helpers.ts`): `disableWarnings(stores)` → rows with their held `work`, `total`, `outstanding`;
  `disableConfirmReady(reason, preview)` — only the reason gates Confirm (not the warnings, not loading, not a failed read).
- **UI** `DisableWarnings.tsx` inside the Disable dialog (`ControlDialog`, one store or a bulk selection, width 80rem):
  the seven facts per store, held rows highlighted and held counts marked, "Stores still holding work HQ has not
  received: n of m" (or "No store holds work … (m checked)"), and "Nothing here stops the Disable". A failed read
  says so and that Disable is still allowed. Read fresh each opening, not retried. Other controls read no preview.
- **Tests**: both proofs + en/ar key and slot parity for `disableWarnings.*`; whole suite 777 files / 10,697 tests green;
  typecheck clean; lint gates grid-base, contrast, palette, controls OK (boundaries: the known insurance-rules failures only).
- **Drive** `tools/sync-console-disabled-drive.mjs` sections 10/10b/10c (stubbed): **63/63**; controls 113/113, commands 69/69.

**Contract guesses (check against 3917 when it lands):**
1. Response `{ stores: [...] }`, one row per requested code.
2. Row keys reuse existing names for the same facts: `lastConnectOkAt`, `push`/`pull` as `LoopHealth`
   (`lastPassAt`, `lastPassOutcome`, …), `lastTrxPulledAt`, `pendingActions`, `tillBacklogCount` (`null` = never
   measured), `openDeadLetters`; `scriptsWaiting` is a new, guessed name. Plus `code`, `description`.

**Judgement calls:**
- "Outstanding" = any of the four counts above zero. A never-measured backlog, an old/absent good connect, or a failed
  last pass is shown but does not highlight the row — it is not work known to be held.
- Rows keep the door's order (no sort by held work).
- The count sentence avoids plural agreement ("…: n of m") so the partial ar bundle needs no Arabic plural forms.
- A failed preview shows the core's `apiErrorMessage` (a 5xx reads as the generic "unexpected error").

**Owed:** the staging walk on BO 3917 — the table for a store with a backlog, and a Disable confirmed past it.
