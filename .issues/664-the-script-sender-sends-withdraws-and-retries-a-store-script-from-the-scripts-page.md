---
status: open
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

- [ ] `scripts-helpers.test.ts`: the target payload (all → no codes, chosen → codes), the preview sentence, and when
      Retry / Withdraw are offered
- [ ] `control-helpers.test.ts`: the three audit actions are labelled
- [ ] `tools/sync-console-scripts-drive.mjs` (stubbed): no controls without `canRunScripts`, Confirm waits for the
      preview, a send posts `preview: false` with the reason, a refusal keeps the dialog open, withdraw and retry post
      their bodies
- [ ] `npm run typecheck`, `npm test`, `npm run lint`

## Boundaries

No editing of a sent script (ADR 0115).

## Done when

The proofs above hold. The live walk is the owner's, once the grant is given.

## Blocked by

[663](663-the-sync-delegate-sees-sent-store-scripts-and-each-stores-state-on-the-scripts-page.md), BackOffice 3205,
BackOffice 3206
