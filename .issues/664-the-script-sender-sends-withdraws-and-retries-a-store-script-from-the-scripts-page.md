---
status: done
spec: BackOffice 3202 (D14); doors BackOffice 3205, 3206
blocked-by: 663, BackOffice 3205, BackOffice 3206
---

# 664 — The script sender sends, withdraws and retries a store script from the Scripts page

## What to build

The controls on the Scripts page, shown only with `canRunScripts` (`ActionSync.RunStoreScript`).

- **Send**: a dialog with a title, the SQL (monospace, character count against 8,000), and a target.
  - The target is **All eligible stores** (default) or **Chosen stores**: a searchable multi-pick over
    `GET ActionSync/Scripts/Eligible`, with paused stores marked.
  - Preview first (`preview: true`): it lists the exact stores, and says that the script may run more than once and
    must be safe to re-run.
  - Confirm stays disabled until a preview answers. It posts with `preview: false` and the reason.
  - A refusal shows its code (`SCRIPT_HAS_GO`, `SCRIPT_TOO_LONG`, `SCRIPT_EMPTY`, `TITLE_REQUIRED`, `NO_STORES`,
    `UNKNOWN_STORE` / `NOT_ELIGIBLE` with the named codes), and the dialog stays open.
- **Withdraw** on a script's detail: preview (how many stores have not run it), then confirm with a reason. The
  dialog says that stores which already ran it stay executed, and that a withdrawn script cannot be sent again
  (send a new one).
- **Retry** on an exhausted store row, and **Retry all exhausted** on the detail: preview, then confirm with a reason.
- Success: a toast, and the list, the detail and the audit feed are re-read. The audit feeds label `SendScript`,
  `WithdrawScript` and `RetryScript`.
- None of these is offered on a legacy script.

## Spine reach

ui · api client · test · drive (stubbed)

## Proof (→ `tdd` red-green cycles)

- [x] `scripts-helpers.test.ts`: the target payload (all → no codes, chosen → codes), the preview sentence, and when
      Retry / Withdraw are offered
- [x] `control-helpers.test.ts`: the three audit actions are labelled
- [x] `tools/sync-console-scripts-drive.mjs` (stubbed): no controls without `canRunScripts`, Confirm waits for the
      preview, a send posts `preview: false` with the reason, a refusal keeps the dialog open, withdraw and retry post
      their bodies
- [x] `npm run typecheck`, `npm test`, `npm run lint`

## Done (2026-10-29) — stubbed; live waits on BackOffice 3205/3206

- `ScriptsPage`: **Send a store script** above the list, behind `canRunScripts` (optional on `SyncConsoleAccess`,
  absent = no; predicate `canRunStoreScripts`). `SendScriptDialog` on the shared `ReasonDialog` (now with an optional
  `width`): title, SQL (monospace, `dir="ltr"`, counted `n / 8,000`, red over the cap), target chips **All eligible
  stores** (default) / **Chosen stores** (the core `MultiSelect` over `GET ActionSync/Scripts/Eligible`, paused stores
  muted and marked), the re-run warning, and a preview box that lists the exact stores. Send stays disabled until a
  preview has answered **for the draft as it stands**: any edit to title, SQL or target sets the preview aside (the
  draft rides the preview's mutation variables, so an edit made in flight is not stamped as previewed).
- `ScriptDetailModal` footer: **Withdraw** and **Retry all exhausted**; `buildScriptStoreColumns` gains a Retry column
  (only with the grant on a live script) whose button shows on exhausted rows. All three open `ScriptActionDialog`
  (preview → count sentence → confirm with reason). None on a legacy or withdrawn script; Withdraw needs a store not yet
  run, Retry all needs an exhausted one (`scriptControls`, `storeRetryOffered`).
- Success toasts, then `SCRIPTS_KEY` (list + detail + eligible) and `AUDIT_KEY` are invalidated. Audit labels
  `SendScript` / `WithdrawScript` / `RetryScript`. Refusals show their code and words (`scriptCodes.*`) and keep the
  dialog open; a preview's refusal in its own titled banner (`ScriptRefusal`), a confirm's under the reason.
- Proof: `scripts-helpers.test.ts` +20, `control-helpers.test.ts` +1 (mutation-checked: dropping the withdrawn guard
  fails 2); drive **81/81 stubbed** (36 → 81, sections 7–11); objects drive 25/25; typecheck, vitest, lint 5/5, build.
- Review fixes (2026-10-29): Withdraw / Retry wait for the detail to answer (none while pending or failed); a left-out
  `withdrawnAt` reads as not withdrawn; a fresh preview clears a confirm's refusal (Send and Withdraw/Retry); the send
  toast words `fsi(figure(n))`; the Send dialog stays mounted if access re-reads mid-edit. Drive **89/89**, objects 25/25.
- 🚩 Contract guesses (doors 3205/3206 unbuilt, contract silent): Eligible answers `{ items: [...] }`; refusals that
  name stores carry them as `data.codes: string[]` (the message is always shown too, so a door without the list loses
  nothing); preview answers have `scriptId` / `auditId` `null`; the send title is trimmed, the SQL sent byte for byte.
- Owner rulings (overrulable): Withdraw is hidden when every store has executed (nothing to mark); Send does not block
  a GO line or an over-long script client-side — the door judges (D10), the dialog only counts.

## Boundaries

No editing of a sent script (ADR 0115).

## Done when

The proofs above hold. The live walk is the owner's, once the grant is given.

## Blocked by

[663](663-the-sync-delegate-sees-sent-store-scripts-and-each-stores-state-on-the-scripts-page.md), BackOffice 3205,
BackOffice 3206
