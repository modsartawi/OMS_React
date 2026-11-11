---
status: done
spec: 863
blocked-by: —
---

# 864 — A technician re-runs the stores whose tables failed as a new campaign linked to the original

## What to build

Slice 0 (the tracer): the whole **re-run** path, from a campaign with failed stores to a new campaign
that knows it is a re-run of it. Exclusion of stores already in a live re-run is **not** here (865).

**DataSync** (`C:\Work\Replicate_SqlDataCompare`):

- **Migration 012:** a nullable re-run-of column on the campaign (NULL = not a re-run) plus an index on
  it. Existing campaigns read back as non-re-runs.
- **`GET /Campaigns/{campaignId}/RerunTargets`** (View): the campaign's re-runnable jobs — `Failed` with
  `TableFailures`, `Error` or `StoreWpfHosted`, decided by the server's own retryable rule (never
  `StoreUnreachable` / `TargetUnresolved`). Per job `{client, code, failureReason, unfinishedTables[]}`
  (tables not `Succeeded`); top level `{campaignId, profileId, mode, tables[] (union, profile order),
  targets[], excluded: []}` — `excluded` is always empty until 865. 404 `DATASYNC_CAMPAIGN_NOT_FOUND`.
- **Create** accepts optional `rerunOf`: unknown → 404 `DATASYNC_CAMPAIGN_NOT_FOUND`; different
  profile → 422 `DATASYNC_RERUN_PROFILE_MISMATCH`. The Apply reason rule is unchanged and `rerunOf`
  never satisfies it.
- **Campaign read** gains `rerunOf: {campaignId, name} | null` and `rerunBy: [{campaignId, name,
  status}]` (newest first).
- OpenAPI draft, DataSync spec §2 / §4 / §5, Postman contract and demo handbook updated.

**oms-react** (`features/admin/data-sync`):

- Model + API: the offer shape, `rerunOf` / `rerunBy`, `rerunTargets(campaignId)`, `rerunOf` on the
  create request.
- **New campaign from failed (N)** in the campaign header, behind `canOperate`, N = the offer's target
  count, hidden at 0, available in any campaign state.
- It opens the existing New Campaign dialog in re-run mode: profile shown and locked; stores = the
  offer's codes (removable); tables = the union (removable, never beyond the profile); mode = the
  original's (switchable); **in Apply, WPF-hosted stores are left out and named in a note**; reason
  empty. The rest is the existing flow (Apply: create → pause ActionSync in tagged batches → Start).
- The campaign page shows **Re-run of …** and **Re-run by …** as links.
- English + Arabic strings in `data-sync`.

## Spine reach

state DB (migration) · DataSync doors + read model · contract · model/api · logic · dialog/route · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `RerunTargets_OffersOnlyFailuresRetryRefuses` — with jobs failed for every reason (≥ 6 stores), only `TableFailures` / `Error` / `StoreWpfHosted` come back · DataSync.IntegrationTests
- [x] `RerunTargets_UnfinishedTablesPerReasonAndTheirUnion` — failed tables for `TableFailures`, failed + never-started for a part-way `Error`, all for `StoreWpfHosted`; `tables` is the union in profile order · DataSync.IntegrationTests
- [x] `RerunTargets_UnknownCampaign404_ViewEnough_NoGrant403` · DataSync.IntegrationTests (`DoorGrantTests` family)
- [x] `Create_RerunOf_StoredAndReadBackBothWays` — the new campaign reads `rerunOf`, the original `rerunBy` · DataSync.IntegrationTests
- [x] `Create_RerunOf_UnknownCampaign404_ProfileMismatch422_ApplyReasonStillRequired` · DataSync.IntegrationTests
- [x] `Migration012_AppliesOnAnExistingStateDb` — existing campaigns read `rerunOf: null` · DataSync.IntegrationTests (State)
- [x] Postman contract run green with the new door and fields · `test.ps1`
- [x] `rerunDraft` — from an offer: union kept, profile locked, mode from the original, Apply drops WPF-hosted into a note, reason empty, `rerunOf` set · pure (oms-react)
- [x] `tools/data-sync-rerun-drive.mjs` — with stubs: the button shows N, opens the dialog pre-filled, the create carries `rerunOf`, the links render; no `canOperate` → no button · stubbed drive

## Boundaries

Live state-DB migration (additive, nullable) on the deployed DataSync (DWOMS02) and a new package
deploy — keep the OMS BackOffice site's `/DataSync/*` proxy rule in `web.config`. No flag, no new
grant. No change to the compare/apply engine or ActionSync.

## Done when

All Proof boxes green; on the demo kit a campaign with a table failure offers its store, and the
created re-run shows *Re-run of* the original while the original shows *Re-run by* it.

## Blocked by

None — can start immediately.

## Comments

- 2026-11-10 (code review, DataSync 7357acf / oms-react b1f69ac9): a job is re-runnable when it is Failed and not retryable *in its campaign*, so a Cancelling/Cancelled campaign offers its StoreUnreachable/TargetUnresolved stores too (Retry cannot take them there). Campaign gains rerunnableJobs + rerunnableWpfHostedJobs; the header reads those, and the full RerunTargets offer is read only on click. The live-re-run clash check runs under sp_getapplock on the original id, not a row lock. Demo-kit / live walk owed in 566.
