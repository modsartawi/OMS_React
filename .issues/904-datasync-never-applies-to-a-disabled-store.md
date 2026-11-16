---
status: done
spec: BackOffice 3913
blocked-by: BO 3914
---

# 904 — DataSync never applies to a disabled store

## What to build

BackOffice spec 3913, "DataSync, two places". A **disabled store** keeps `IsPaused = 1` underneath, so today both the
screen and the engine would read it as paused and safe to apply to. Two changes, in two repos:

- **oms-react (data-sync feature).**
  - `actionSyncApi.fleet()` keeps `isDisabled`.
  - The Apply readiness gives a disabled store `never`, with a new why, `disabled`, worded in both languages.
  - The DataSync fleet read must ask the Fleet door for `disabled=only` as well (the default read hides disabled stores),
    so a picked disabled store is recognised as disabled rather than missing.
- **DataSync engine (`C:\Work\Replicate_SqlDataCompare`).**
  - `ActionSyncCoordinator.ReadStoresAsync` also reads `IsDisabled`, so `ActionSyncStoreState` carries it.
  - Creating an Apply campaign refuses a disabled store with a new refusal: "store is disabled on ActionSync".
  - A Resume or Retry re-check refuses it too.
  - The HQ read principal already has SELECT on `ActionSyncStore`.

## Spine reach

UI (data-sync readiness) / DataSync engine (coordinator, refusal)

## Proof (→ `tdd` red-green cycles)

- [x] `readiness_disabledStore_isNeverDisabled` · data-sync apply-helpers.test.ts
- [x] `fleet_readsDisabledStoresToo` · data-sync apply-helpers.test.ts
- [x] `Create_ApplyCampaign_RefusesDisabledStore` · DataSync test suite
- [x] `RetryOrResume_RefusesStoreDisabledSinceStart` · DataSync test suite

## Boundaries

**Deploy order:** BackOffice HQ migration 012 (3914) must have run before the DataSync build that reads `IsDisabled`
ships. Otherwise the coordinator's SELECT fails on the missing column.

## Done when

The proofs are green in both repos and the DataSync package is built (deploy follows 012).

## Blocked by

BackOffice 3914

## Comments

**2026-11-16 — built (implementer).** Both halves red-green; BackOffice doors stubbed.

- **oms-react** (`ticket/3913-904`, worktree `oms-react-t904`): `68ad514f` (the slice), `825ea235` (merge of
  `spec/3913-disabled-stores` @ `5f2adca8`; one conflict in `StoreRow.isDisabled`, resolved to 900's fuller field set).
  - `readReadinessFleet` (apply-helpers, pure, injected `get`) pages the default fleet then `disabled=only`;
    `actionSyncApi.fleet()` calls it. A store is disabled only when a row says so, so a pre-3914 door that ignores
    `disabled=only` marks nothing disabled (tested). `applyReadiness`: disabled → `never`, why `disabled`.
  - The engine's new refusal `DATASYNC_STORE_DISABLED` is worded for job Resume/Retry and the create warnings; every
    new string in en and ar.
  - After the merge: typecheck clean; vitest 10,696/10,696 (777 files; data-sync 170); lint: grid/contrast/palette/controls green, the boundary gate
    fails on 4 pre-existing `insurance-rules/aliases` violations identical on the base (not this ticket).
  - Drives: `data-sync-apply-drive` 71/71 (now picks a disabled store D001 → `never: disabled`, and asserts the
    `disabled=only` read), `data-sync-controls-drive` 81/81, `data-sync-handback-drive` 32/32.
- **DataSync engine** (`ticket/904-disabled-store`, worktree `Replicate_SqlDataCompare-904`): `b99708c`.
  - `ReadStoresAsync` selects `IsDisabled`; `ActionSyncStoreState.IsDisabled`; `StoreSafety.Disabled` from the predicate.
  - Create: per-store warning `DATASYNC_STORE_DISABLED` (409, `DS-0409-09`); only-disabled targets → existing
    no-target-safe 409. Job Resume/Retry → 409 `DATASYNC_STORE_DISABLED`. Never `actionSyncResumable`.
  - test.ps1 / publish.ps1: 625 unit + 418 integration/contract/e2e green. (A first run had one load flake,
    `WorkerHostGateTests.The_worker_instance_claims_and_runs_queued_jobs`, fake runner, no ActionSync path; green
    alone and in the publish run.)
  - Package: `C:\Work\Replicate_SqlDataCompare-904\artifacts\deploy\b99708c`. **Not deployed**: HQ migration 012
    first (DEPLOY.md prerequisite #7 added); without it the coordinator's SELECT fails.
- **Guesses / open rulings:**
  - A job whose store is disabled after create fails at job start (or reclaim) as `Error` (detail names the
    disabled store), not a new failure reason — avoids widening the `failureReason` contract. Rule if a
    `StoreDisabled` reason is wanted.
  - Create keeps the disabled store as a job (warned, like WPF-hosted) rather than dropping it from the targets.
  - The dispatcher's poll treats Disabled like WPF-hosted (re-queued so the start gate fails it).
  - Ar wording "وحدة المزامنة" for the sync console is a guess.
