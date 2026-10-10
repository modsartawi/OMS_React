---
status: done
spec: 444
blocked-by: 457
---

# 458 — The sync delegate retries and acknowledges mirror dead letters with a reason

BackOffice spec 2563 (door 2569).

## What to build

On the Mirror tab:

- **Selection.** Select dead letters (capped at 50, reusing `useCappedSelection`).
- **Actions.** **Retry** is offered only when `canRetry`, i.e. apply stage and unacknowledged.
  **Acknowledge as lost** is offered for both stages. Both go through the existing `ReasonDialog`
  (reason required).
- **Results.** Shown per row in the `ControlResults` style. Refusals `PULL_STAGE`, `ACKNOWLEDGED`,
  `NOT_DEAD_LETTER` and `NOT_FOUND` each get a readable label. Then the tab and the store header are
  re-read.
- **Audit.** The audit feeds (fleet and store) label the new actions `MirrorRetry`,
  `MirrorAcknowledge` and `AgreementRecheck`.
- **Grant.** These actions are hidden without `canOperate`. The tab stays read-only.

## Spine reach

UI → app (BackOffice write door, stubbed)

## Proof (→ `tdd` red-green cycles)

- [x] `deadLetterActions(rows, canOperate)`: retry only when every selected row can be retried;
  acknowledge for any unacknowledged row; nothing without the grant (vitest).
- [x] `mirrorRefusalLabel`: every per-row code gets a label (vitest).
- [x] `tools/sync-console-controls-drive.mjs` extended: retry and acknowledge with a reason, mixed
  per-row results, the re-read, the read-only view, the new audit labels.
- [x] Gates green.

## Boundaries

oms-react only.

## Done when

The helpers and the extended drive are green.

## Blocked by

[457](457-the-store-page-shows-the-mirror-summary-the-strip-s-mirror-line-and-the-mirror-tab.md)

## Comments

- 2026-10-10 (AFK): **done**. Every proof is stubbed, because BackOffice 2569 is not built yet. Nothing here was driven against a live SIS.Api.
  - **Selection.** `useCappedSelection` (cap 50) keys each row as `stage-id`. Its new optional `cappedKey` makes the cap message say "dead letters" instead of "stores". An acknowledged row has no checkbox (`isRowSelectable` + `hideDisabledCheckboxes`).
  - **Actions** (`deadLetterActions`, in `control-helpers.ts`):
    - Retry is enabled only when every selected row has the door's `canRetry`. It is never recomputed from the stage.
    - Acknowledge as lost is enabled when every selected row is unacknowledged, of either stage.
    - Both buttons are drawn but disabled while the selection does not allow them.
    - Both actions go through `ReasonDialog`. The POST body is `{ code, items: [{ stage, id }], reason }`, for one store.
  - **Request-level refusals** are shown in the dialog through `apiErrorMessage` and `apiErrorCode`.
  - **Per-row results** use `ControlResults`, under the title "…: refused for these dead letters". Each row is named `id · Stage` (`formatPair`) and worded by `mirrorRefusalLabel`. An unknown code shows raw. The toast uses the new `deadLetterResults` group.
  - **Re-read.** Afterwards the console re-reads the whole `storeKey(code)` prefix (the tab and the header, among others), the fleet and the audit feed.
  - **Without `canOperate`** there is no checkbox column and no bar.
  - **Audit labels.** `UnlabelledAuditAction` is deleted. `MirrorRetry`, `MirrorAcknowledge` and `AgreementRecheck` are labelled in `AUDIT_ACTIONS` and in the bundle.
  - **Proof:**
    - vitest: `control-helpers.test.ts`, 35 tests (`deadLetterActions`, `mirrorRefusalLabel`, the summary with `labelOf`, audit labels).
    - Full suite: 4528 tests pass.
    - Controls drive: 110/110. Sections 1–7 (67 checks) are unchanged. Sections 8–10 are new: 43 checks covering retry and acknowledge, mixed per-row results, the re-read, the read-only view and the audit labels.
    - The other drives are green and unchanged: store 136/136, fleet 72/72, commands 69/69, onboard 83/83.
    - Typecheck, all four lint gates and the build pass.
  - **Outstanding (not AFK's to do):**
    - a human's eye on the bar and the dialog;
    - the live doors (ticket 460).
  - Decisions are logged in `.afk/HITL-458.md`.

