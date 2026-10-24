---
status: open
spec: 558
blocked-by: 560
---

# 562 — A technician reviews a compare's row-level changes before anyone applies

## What to build

The **Changes** view, `/admin/data-sync/jobs/:jobId/changes`, opened from a report-only job's drawer
(560) by holders of `canOperate`:

- **Filters:** table (from the job's tables) and kind (only at source, different, only at store),
  kept in the URL. 50 a page; Next enabled only on a full page.
- **Rows:** the table, the kind, the key (column → value, `Ltr`), and the differing values side by
  side, source against store, for **only** the columns that differ. A source-only row shows the
  source side only and a store-only row the store side only. Values are free text (`<bdi>`); a NULL
  shows as a distinct NULL marker, never as an empty string.
- **Notices:** a table flagged `manifestTruncated` says the counts are exact but rows stop at the cap.
  410 `DATASYNC_MANIFEST_PRUNED` says the rows were pruned after the retention window and the counts
  remain on the job.
- **Gate:** the drawer's link shows only with `canOperate` and only on report-only jobs; a bare 403
  shows the denied state.

🚩 Rows may hold personal data from both servers: never logged, never stored, never exported.

## Spine reach

model/api · store/logic · component/route · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `changesQuery`: table, kind and page build the exact query through `dataSyncApi.changes` with `fetch` stubbed · pure
- [ ] `changeCells`: Different → both sides for the differing columns; SourceOnly / TargetOnly → one side; NULL vs `''` stay distinct · pure
- [ ] `tools/data-sync-changes-drive.mjs`: with stubs, the filters reach the request, rows render for each kind, the truncated and pruned notices show, and no link without `canOperate`

## Boundaries

New endpoint: `GET DataSync/Jobs/{id}/Changes` (Operate). Code handled: 410 `DATASYNC_MANIFEST_PRUNED`.

## Done when

From stubs, a report-only job's differences are reviewable by table and kind; the helpers and the
drive are green.

## Blocked by

[560](560-a-technician-follows-a-campaign-s-jobs-and-each-store-s-tables-as-they-run.md)
