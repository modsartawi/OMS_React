---
status: done
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

- [x] `jobStateWords`: every `JobStatus` × phase × wait reason × hold reason maps to a label and severity; `BackingOff` carries `notBefore` · pure
- [x] `failureWords`: every job and table failure code maps to a sentence key; an unknown code falls back to its raw text · pure
- [x] `pollInterval` and `tableProgress`: polling stops when every job is terminal; progress is indeterminate while `chunksTotal` is null · pure
- [x] `tools/data-sync-campaign-drive.mjs`: with stubs, the rollup and grid render, the status filter and paging reach the request, the drawer opens from the URL, the poll stops on a Completed stub (Playwright clock), a 404 shows not-found

## Boundaries

New endpoints: `GET DataSync/Campaigns/{id}`, `…/{id}/Jobs`, `DataSync/Jobs/{id}`. Code handled:
404 `DATASYNC_CAMPAIGN_NOT_FOUND`, `DATASYNC_JOB_NOT_FOUND`. Read-only; no controls yet (563).

## Done when

A campaign page from stubs shows its jobs and a job's tables, refreshing until done; the helpers and
the drive are green.

## Blocked by

[559](559-a-technician-sees-datasync-s-campaigns-and-profiles-on-one-page.md)

## Comments

**2026-10-24 — built (branch `ticket/560`).** Helpers in `src/features/admin/data-sync/job-helpers.ts`
(`job-helpers.test.ts`, 26 tests); page `CampaignPage.tsx` + `CampaignHeader.tsx`, `JobDrawer.tsx`,
`job-columns.tsx`, `JobStateView.tsx`; reads `dataSyncApi.campaign/campaignJobs/job` + `campaignQuery`,
`campaignJobsQuery`, `jobQuery` under one prefix `campaignKey(id)`. Drive `tools/data-sync-campaign-drive.mjs`
60/60 against stubs (559's drive still 55/55). Nothing driven against a live DataSync (566).

Decisions an owner may overrule:
- **Polling** keys on the campaign's rollup (`queued + running + paused > 0`, covering every page) OR any
  non-terminal job on the page shown, and stops at `Completed` / `Cancelled`. A `Paused` job counts as
  in flight, so a paused campaign keeps polling every 5 s. When the read that sees the campaign finish
  stops the poll, the jobs and the open job are read **once more** so the grid does not keep stale
  Running rows (found by the drive).
- **Severity:** `Queued` with a wait reason (WaitingForPause, BackingOff) reads `warn`, a plain `Queued`
  `mute`; `Paused` `warn`; `Cancelled` `bad` (as the campaign badge).
- **Failure parsing:** a table's "code plus detail" matches the leading whole word against the known codes
  and drops one `:` / `-` / dash after it; anything else shows the raw text. A job reason is matched the
  same way. The detail is shown after the sentence as `<bdi>` free text.
- **Store** shown as `client/code` (`storeLabel`, one string, one `Ltr`) — DataSync's own spelling.
- **Drawer** reads `GET Jobs/{id}` rather than the row from the jobs page, so a `?job=` link to a job on
  another page or filter still opens. An unknown job shows not-found inside the drawer.
- The drawer's tables are an AG Grid (`domLayout="autoHeight"`), drawer 80rem wide.

Seams left for 561–565 (all in `CampaignPage.tsx`, near the top of `CampaignView`): `headerActions`
(→ `CampaignHeader`'s `actions` slot), `jobRowActions` (→ `buildJobColumns`' `rowActions`, adds an
`actions` column), `jobDrawerFooter` (→ `JobDrawer`'s `footer(job)`). Invalidate the whole page with
`campaignKey(campaignId)`.
