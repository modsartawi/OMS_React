---
status: open
spec: 558
blocked-by: 559, 560, 561, 562, 563, 564, 565
---

# 566 — The data-sync screens call the real DataSync service

## What to build

A live walk of every data-sync screen against a running DataSync, replacing stubs with the real
doors, and fixing whatever the walk finds.

**Prerequisites (owner acts):**
- DataSync running and reachable: locally with the demo kit (`C:\Work\Replicate_SqlDataCompare\demo\setup-demo.ps1`,
  then `demo\run-demo-api.ps1`, on `http://127.0.0.1:5280/DataSync`), or deployed behind the SIS.Api
  host's `/DataSync/*` route on staging.
- **One HQ for both services:** DataSync validates the `sis_session` cookie against its configured HQ,
  so it must point at the same HQ as the SIS.Api the page logs into (`:5111` or `SIS_API`). The demo
  kit's own HQ (`DataSyncDemo_Hq`) only works with its own minted tokens, not with a real login.
- The `DataSyncConsole` screen and `DATASYNC_VIEWER` / `DATASYNC_OPERATOR` seeded in that HQ (rows as in
  `demo\sql\50_hq_schema.sql`) and granted to the walk's users; `ActionSync.Operate` for the apply
  steps.
- DataSync asks A and B (spec 558) built in `C:\Work\Replicate_SqlDataCompare`, or the walk skips
  picked stores and the pause-first apply.

**The walk:** a `tools/data-sync-live-drive.mjs` (the `sync-console-live-drive` precedent) that, with
`DATASYNC_API` set, logs in, opens the screen, runs a report-only compare against the demo target,
reads its changes, applies the North-window profile, pauses and resumes a job, and checks the counts
match the demo's expected drift (`demo\README.md`: DemoCategory 1/1/1, DemoProduct 60/384/25, North
window 7/55/3). A viewer user sees everything read-only and no Changes link.

## Spine reach

test (live) · fixes in any layer

## Proof (→ `tdd` red-green cycles)

- [ ] `tools/data-sync-live-drive.mjs` green against a running DataSync
- [ ] Every wire mismatch the walk finds fixed in `core/models/data-sync.ts` and noted here, or filed as a DataSync ask

## Boundaries

No new screens. Mismatches go to the OpenAPI draft and DataSync first, then here.

## Done when

The live drive is green against a real DataSync on the same HQ as SIS.Api, as operator and viewer.

## Blocked by

[559](559-a-technician-sees-datasync-s-campaigns-and-profiles-on-one-page.md),
[560](560-a-technician-follows-a-campaign-s-jobs-and-each-store-s-tables-as-they-run.md),
[561](561-a-technician-runs-a-report-only-compare-of-a-profile-against-chosen-stores.md),
[562](562-a-technician-reviews-a-compare-s-row-level-changes-before-anyone-applies.md),
[563](563-a-technician-pauses-resumes-or-cancels-a-campaign-or-one-store-s-job.md),
[564](564-a-technician-applies-a-profile-to-stores-with-actionsync-paused-first.md),
[565](565-stores-whose-apply-succeeded-are-handed-back-to-actionsync-the-rest-stay-paused.md)
