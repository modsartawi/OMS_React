---
status: done
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

- [x] `changesQuery`: table, kind and page build the exact query through `dataSyncApi.changes` with `fetch` stubbed · pure
- [x] `changeCells`: Different → both sides for the differing columns; SourceOnly / TargetOnly → one side; NULL vs `''` stay distinct · pure
- [x] `tools/data-sync-changes-drive.mjs`: with stubs, the filters reach the request, rows render for each kind, the truncated and pruned notices show, and no link without `canOperate`

## Boundaries

New endpoint: `GET DataSync/Jobs/{id}/Changes` (Operate). Code handled: 410 `DATASYNC_MANIFEST_PRUNED`.

## Done when

From stubs, a report-only job's differences are reviewable by table and kind; the helpers and the
drive are green.

## Blocked by

[560](560-a-technician-follows-a-campaign-s-jobs-and-each-store-s-tables-as-they-run.md)

## Comments

**2026-10-24 — built (stubbed).** `changes-helpers.ts` (+ 12 vitest cases), `ChangesPage.tsx` at
`/admin/data-sync/jobs/:jobId/changes`, `change-columns.tsx`, `ChangesLink.tsx`
(`useChangesLinkFooter(mode)` fills 560's `jobDrawerFooter` seam), `dataSyncApi.changes`,
`changesJobQuery`, `changesListQuery`. Drive `tools/data-sync-changes-drive.mjs` 50/50 against stubs;
560's campaign drive still 60/60. No live DataSync (566 owns the walk).

Decisions an owner may overrule:
- **Report-only is read from the campaign's `mode`**, not inferred from the job's table
  dispositions (an Apply campaign can hold ReportedOnly tables, and its manifest is always `[]`).
  An unknown mode hides the link.
- **The footer seam returns `undefined` when the link would not show**, so a viewer / Apply job
  gets no empty footer (560's drive asserts that). 563 composing on the same seam needs to merge two
  possibly-undefined footers.
- **The view's own gate is `canOperate`** (`ScreenGate` with `keyPrefix="changes.access"`, its own
  "No access to changes" sentence); a viewer on the address never calls the Changes door. A bare 403
  from the door itself shows the same denial.
- **Markers:** NULL → a boxed `NULL`; `""` → `(empty)`; a side the row does not have → "not at
  source" / "not at store". A Different column the door sent on one side only reads NULL on the
  other; a column whose two sides are equal is dropped (safeguard — the door already sends only
  differing columns).
- **Key** drawn as `column · value` (`formatPair`, one `Ltr` per pair); a NULL key value as the
  column then `NULL`.
- **The truncated notice** names the capped tables, narrowed to the filtered table; hidden while the
  pruned notice shows.
- 🚩 **Personal data:** no export, no copy affordance, nothing logged; the rows query is `gcTime: 0`
  (memory only while shown). The drive asserts no row value reaches the console, localStorage or
  sessionStorage. Table/kind/page are the only things in the URL.
