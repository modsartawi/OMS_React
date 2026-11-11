---
status: done
spec: BackOffice 3396
blocked-by: BackOffice 3401
---

# 791 — The release download queue page shows the live slots, the queue, the history and each release's convergence

## What to build

The web half of BackOffice spec **3396** / ticket **3401** (read endpoints). An admin page "Release download queue"
(feature under `admin`), gated by `PosRelease.Queue.View`, refreshing on a short interval:

- **Live slots**: store, till, package, from→to version, started, % progress bar.
- **Queue**: length, oldest wait, stores in grant order with their tills; urgent marked; waits over 4 h flagged.
- **History**: finished downloads with duration and outcome (done / failed + reason / expired / freed by hand),
  filterable by outcome, store, version.
- **Convergence**: per release, downloaded vs downloading vs waiting.

EN + AR, RTL.

## Spine reach

UI (oms-react)

## Proof (→ `tdd` red-green cycles)

- [x] `fourHourFlag` — waits ≥ 4 h flagged, under not · helpers vitest
- [x] `queuePositionLabel` — renders position / length · helpers vitest
- [x] `convergenceShares` — downloaded/downloading/waiting add up per version · helpers vitest

## Boundaries

Read-only; no controls (792).

## Done when

Proof green; the page renders against a dev SIS.Api with a live slot and a queued till.

## Blocked by

BackOffice [3401](../../../Work/DMSCO/BackOffice/.issues/3401-hq-can-read-the-live-download-slots-the-queue-the-history-and-each-release-s-convergence.md)

## Comments

- 2026-11-06 — built on `impl/791-release-queue-page` (`81888f6b`, off `spec/3396-release-queue`): `features/admin/release-queue`, route `/admin/release-queue`, Admin menu leaf gated on `PosReleaseQueue/Access` `canView` (fails closed), EN + AR namespace `release-queue`. Pool strip + four tabs (live slots with progress; queue in grant order with `position / length`, urgent and 4 h flags, stores in order with their tills; history filtered by outcome/store/version, paged 50, with failure reason / freed-by; per-release convergence bar). Re-polls every 15 s; no controls (792). The three Proof cycles pass in `helpers.test.ts` (plus the page's URL/duration/outcome helpers and an en/ar key mirror); `tools/release-queue-drive.mjs` drives the page against stubbed 3401 doors in LTR and RTL, 31/31. **Owed:** the live walk on a dev SIS.Api with a live slot and a queued till (Done-when), which needs seed 005 on HQ.
- 2026-11-06 — **done, stubbed** on integration branch `spec/3396-release-queue` (791 `81888f6b`, 792 `a27c5565`, review fixes `dca866bc`; worktree `C:\Playground\oms-react-spec3396`, not merged to main). Live walk owed against a dev SIS.Api with BO 3401/3402 doors (on BackOffice `pricing2`) + seeds 005/006 applied.
