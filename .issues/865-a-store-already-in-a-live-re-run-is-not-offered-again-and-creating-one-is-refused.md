---
status: done
spec: 863
blocked-by: 864
---

# 865 — A store already in a live re-run is not offered again, and creating one is refused

## What to build

Clicking *New campaign from failed* twice on one campaign must not put the same store into two
campaigns.

**DataSync:**

- `RerunTargets` moves a re-runnable store into `excluded[]` as `{client, code, rerunCampaignId}`
  when it is a target of a **live** re-run of this campaign — a direct re-run (its `rerunOf` = this
  campaign) in any state but `Cancelled`. A cancelled re-run releases its stores. Only direct re-runs
  count: a store that failed again in a re-run is offered from that re-run, not from its grandparent.
- Create with `rerunOf` refuses 422 `DATASYNC_STORE_IN_LIVE_RERUN`, naming the stores, when any
  requested store is in a live re-run of the named campaign. **The refusal is the guard; the dialog's
  omission is the courtesy.**
- OpenAPI draft, DataSync spec, Postman contract updated.

**oms-react:**

- The button's N excludes them; the re-run dialog names each excluded store and its re-run ("P014 is
  in re-run 01JE…"), and the new refusal code maps to a sentence.

## Spine reach

DataSync door + create validation · contract · logic · dialog · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `RerunTargets_StoreInLiveRerun_Excluded` — seed ≥ 5 re-runnable stores, re-run 2; the offer returns 3 targets and 2 excluded naming the re-run · DataSync.IntegrationTests
- [x] `RerunTargets_CancelledRerun_ReleasesItsStores` · DataSync.IntegrationTests
- [x] `RerunTargets_RerunsOwnFailures_NotOfferedFromGrandparent` · DataSync.IntegrationTests
- [x] `Create_StoreInLiveRerun_Refused422NamingStores` · DataSync.IntegrationTests
- [x] Mutation check: break the live predicate (e.g. count `Cancelled` as live) once and see the tests fail
- [x] `rerunDraft` — excluded stores become notes, never targets; `createRefusalWords` maps `DATASYNC_STORE_IN_LIVE_RERUN` · pure (oms-react)
- [x] `tools/data-sync-rerun-drive.mjs` — a stubbed second click shows the excluded note and a smaller N · stubbed drive

## Boundaries

DataSync package deploy; no migration (uses 864's column and index). No flag.

## Done when

All Proof boxes green; on the demo kit a second re-run of the same campaign leaves out the stores the
first one holds, and a direct create naming one is refused.

## Blocked by

[864](864-a-technician-re-runs-the-stores-whose-tables-failed-as-a-new-campaign-linked-to-the-original.md)
