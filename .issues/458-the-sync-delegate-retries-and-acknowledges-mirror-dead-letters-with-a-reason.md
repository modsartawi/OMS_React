---
status: open
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

- [ ] `deadLetterActions(rows, canOperate)`: retry only when every selected row can be retried;
  acknowledge for any unacknowledged row; nothing without the grant (vitest).
- [ ] `mirrorRefusalLabel`: every per-row code gets a label (vitest).
- [ ] `tools/sync-console-controls-drive.mjs` extended: retry and acknowledge with a reason, mixed
  per-row results, the re-read, the read-only view, the new audit labels.
- [ ] Gates green.

## Boundaries

oms-react only.

## Done when

The helpers and the extended drive are green.

## Blocked by

[457](457-the-store-page-shows-the-mirror-summary-the-strip-s-mirror-line-and-the-mirror-tab.md)
