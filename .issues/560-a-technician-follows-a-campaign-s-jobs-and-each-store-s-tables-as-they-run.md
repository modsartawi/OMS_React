---
status: open
spec: 558
blocked-by: 559
---

# 560 — A technician follows a campaign's jobs and each store's tables as they run

## What to build

The campaign page, `/admin/data-sync/campaigns/:campaignId`:

- **Header:** name, profile, mode, status, reason (Apply), created, started and finished times, and
  the rollup tiles from `jobsByState` with its `asOf` stamp.
- **Jobs grid:** one row per store (`client/code` as `Ltr`), status badge with phase, the wait reason
  (`WaitingForPause`, or `BackingOff` until `notBefore`), the hold reason (`Operator` or `StoreBusy`),
  attempts, started and finished times, and the failure reason as a sentence. Server-paged at 50 and
  filtered by job status, both kept in the URL.
- **Job drawer** (`?job=<jobId>`, so it can be linked): the target server and database and each
  table: status, phase, disposition (Applied or Reported only), strategy, a progress bar
  (`chunksDone / chunksTotal`, indeterminate while `chunksTotal` is null), rows compared, to insert,
  to update, to delete, rows applied, the failure reason, and a "manifest truncated" flag.
- **Refresh:** the campaign and its jobs every 5 s while any job is non-terminal and the tab is
  visible; it stops once the campaign is `Completed` or `Cancelled`. An unknown id
  (404 `DATASYNC_CAMPAIGN_NOT_FOUND` / `DATASYNC_JOB_NOT_FOUND`) shows a not-found state.

## Spine reach

model/api · store/logic · component/route · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `jobStateWords`: every `JobStatus` × phase × wait reason × hold reason maps to a label and severity; `BackingOff` carries `notBefore` · pure
- [ ] `failureWords`: every job and table failure code maps to a sentence key; an unknown code falls back to its raw text · pure
- [ ] `pollInterval` and `tableProgress`: polling stops when every job is terminal; progress is indeterminate while `chunksTotal` is null · pure
- [ ] `tools/data-sync-campaign-drive.mjs`: with stubs, the rollup and grid render, the status filter and paging reach the request, the drawer opens from the URL, the poll stops on a Completed stub (Playwright clock), a 404 shows not-found

## Boundaries

New endpoints: `GET DataSync/Campaigns/{id}`, `…/{id}/Jobs`, `DataSync/Jobs/{id}`. Code handled:
404 `DATASYNC_CAMPAIGN_NOT_FOUND`, `DATASYNC_JOB_NOT_FOUND`. Read-only; no controls yet (563).

## Done when

A campaign page from stubs shows its jobs and a job's tables, refreshing until done; the helpers and
the drive are green.

## Blocked by

[559](559-a-technician-sees-datasync-s-campaigns-and-profiles-on-one-page.md)
