---
status: open
spec: 558
blocked-by: 561, 563
---

# 564 — A technician applies a profile to stores, with ActionSync paused first

## What to build

The New campaign dialog (561) gains **Apply** mode:

- **Reason:** required, trimmed, at least 10 characters, checked as typed.
- **What gets written:** of the selected tables, those with `applyAllowed` are listed as written and
  the rest as only reported. If none is appliable, Apply can't be chosen (the door's 422
  `DATASYNC_PROFILE_NO_APPLY_TABLES` is the backstop).
- **Store readiness** from `ActionSync/Fleet` for the picked stores (`fleet: 'all'` checks the fleet's
  pages): **WPF-hosted** → named as never appliable, with a one-click "drop them"; on the worker and
  paused and acknowledged → ready; on the worker otherwise → will be paused.
- **"Pause ActionSync first"**, on by default. The flow, per spec 558:
  1. create the campaign (Apply + reason) → Ready, with its id;
  2. pause the stores through `ActionSync/Stores/Control` (`Pause`) in batches of ≤ 50, reason
     `DataSync campaign <campaignId>: <reason>`; per-store refusals (`NOT_ON_WORKER`, `NO_STORE`)
     listed;
  3. Start. Stores not yet acknowledged wait server-side as `Queued(WaitingForPause)`.
  Turned off, the dialog warns that unpaused stores will wait until someone pauses them.
- **Create warnings** (`success: true` with per-store `DATASYNC_STORE_BUSY` /
  `DATASYNC_STORE_WPF_HOSTED`) show on the new campaign, not as a failure. Refusals: 422
  `DATASYNC_REASON_REQUIRED`, `DATASYNC_PROFILE_NO_APPLY_TABLES`, 409 `DATASYNC_STORE_BUSY` (no target
  safe), plus 561's.
- **Grants:** the pause step needs `ActionSync.Operate` (from `ActionSync/Access`, called by this
  feature's own `api.ts`). Without it the toggle is disabled and the dialog says someone who holds it
  must pause the stores.

## Spine reach

model/api · store/logic · component/route · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `buildCreateRequest` (Apply): reason trimmed and required ≥ 10; written vs reported tables from `applyAllowed` · pure
- [ ] `applyReadiness`: each ActionSync row → never / ready / will-pause; batches of ≤ 50 with the tagged reason · pure
- [ ] `tools/data-sync-apply-drive.mjs`: with stubs, the order create → pause batches → start is exact, the reason tag carries the new id, WPF stores can be dropped, warnings and refusals render, the toggle is disabled without `ActionSync.Operate`

## Boundaries

New endpoints: `GET ActionSync/Access`, `GET ActionSync/Fleet`, `POST ActionSync/Stores/Control`
(existing ActionSync doors; types from `core/models/sync-console`, calls written again in this
feature). DataSync codes as above.

## Done when

From stubs, an Apply campaign is created, its stores paused with the campaign's tag, and started, in
that order; the helpers and the drive are green.

## Blocked by

[561](561-a-technician-runs-a-report-only-compare-of-a-profile-against-chosen-stores.md),
[563](563-a-technician-pauses-resumes-or-cancels-a-campaign-or-one-store-s-job.md)

## Open questions

- **DataSync ask B (create before pause).** The create door refuses an Apply with 409
  `DATASYNC_STORE_BUSY` when no target is safe yet. In this flow that is always true, because the
  stores are paused only after create returns the id the tag needs. Proposed in spec 558: a
  `pauseActionSyncFirst: true` create flag that turns the all-unsafe refusal into per-store warnings.
  Decide before building: build ask B in `C:\Work\Replicate_SqlDataCompare` (recommended), or pause
  untagged first and re-pause with the tag after create.
