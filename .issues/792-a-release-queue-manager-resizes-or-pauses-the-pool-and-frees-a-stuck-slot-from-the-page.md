---
status: done
spec: BackOffice 3396
blocked-by: 791, BackOffice 3402
---

# 792 — A release-queue manager resizes or pauses the pool and frees a stuck slot from the page

## What to build

Controls on the 791 page, visible only with `PosRelease.Queue.Manage`: edit the pool size (0 shown as **Paused**,
with a confirm), and free one live slot (confirm, names the till). Shows who last changed the pool and when.

## Spine reach

UI (oms-react)

## Proof (→ `tdd` red-green cycles)

- [x] `controlsHiddenWithoutManage` · helpers vitest
- [x] `poolZeroReadsAsPaused` · helpers vitest

## Boundaries

Outward-facing: confirm dialogs on both controls.

## Done when

Proof green; a dev pause from the page stops a dev till starting a download.

## Blocked by

[791](791-the-release-download-queue-page-shows-the-live-slots-the-queue-the-history-and-each-release-s-convergence.md), BackOffice [3402](../../../Work/DMSCO/BackOffice/.issues/3402-hq-resizes-or-pauses-the-download-pool-and-frees-a-stuck-slot-and-every-change-is-audited.md)

## Comments

- 2026-11-06 — built on `impl/792-release-queue-controls` (`a27c5565`, off `spec/3396-release-queue` 81888f6b). Both Proof cycles green, plus `poolSizeDraft`, `poolChangeKind` and `lastPoolChange` (which also tolerates a malformed Audit answer, found by the drive). Pool editor (0..500, 0 = Paused) and Free per live slot, each behind its confirm; refusals POSREL-SLOT-001/002/003 stay in the dialog with code and hint; the last-changed line reads `GET PosReleaseQueue/Audit`, falling back to the pool's stamp. typecheck, `npm test` (9140), lint (only the 4 known insurance-rules boundary hits) green; `tools/release-queue-drive.mjs` 60/60 against stubbed 3402 doors, LTR + RTL. **Live walk owed:** a dev pause from the page stopping a dev till (Done-when unticked; no live SIS.Api).
- 2026-11-06 — **done, stubbed** on integration branch `spec/3396-release-queue` (791 `81888f6b`, 792 `a27c5565`, review fixes `dca866bc`; worktree `C:\Playground\oms-react-spec3396`, not merged to main). Live walk owed against a dev SIS.Api with BO 3401/3402 doors (on BackOffice `pricing2`) + seeds 005/006 applied.
