---
status: done
spec: BackOffice 3185 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md, section "Spec 3185")
blocked-by: 647
---

# 650 — The general change log tab filters and exports

## What to build

"Why did this item's priority change?" needs an answer. A **Change log** tab on the General master page
(`?tab=changes`), doors BackOffice 3194
([brief](C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md), "Spec 3185"):

- paged rows, newest first: when, who, entity (item / group) and key, action, before → after (group and priority, or
  the group's fields), reason, and the upload id when it came from a bulk apply;
- filters: item, group, user, date range (local days, inclusive), kept in the URL;
- **Export** downloads the filtered rows as `.xlsx`.

## Spine reach

api · logic (filter ↔ query, before/after rendering) · component · i18n (EN+AR) · test + drive

## Proof (→ `tdd` red-green cycles)

- [x] `change filters round-trip through the URL and refuse to before from` · pure
- [x] `before → after renders set, clear and group edits` · pure
- [x] drive `tools/idf-changes-drive.mjs` — filter by item and dates, page, export (LTR + RTL) · flow

## Boundaries

Endpoints stubbed. View grant only. Reuse 626's filter pieces where they fit.

## Done when

Against stubs, the log filters, pages and exports, proofs green.

## Blocked by

[647](647-the-masters-list-shows-general-and-its-page-lists-the-general-items.md)

## Done 2026-10-28

- Pure: `changes-filter.test.ts` (the proof `change filters round-trip through the URL and refuse to before from`, plus
  the General address under `?tab=changes`), `changes.test.ts` (the proof `before → after renders set, clear and group
  edits`), `download.test.ts` (650 · `changesExportFileName`), door shape in `doors.test.ts` (650), keys in
  `i18n-keys.test.ts` (650). 647's `general.test.ts` `toEqual`s gained the `changes` field.
- Drive: `tools/idf-changes-drive.mjs` 60/60 (LTR + RTL, port 52650) against stubs (`// --- 650 ---` in
  `tools/idf-stubs.mjs`: `IDF_GENERAL_CHANGES` 30 rows, `idfGeneralChangesStub`, `reads.changes` /
  `reads.changesExport`, `deny: ['changes']`, `refuseChangesExport`). `idf-general-drive` re-run green.
- Code: `changes-filter.ts` (address, window check, door params), `changes.ts` (row shape, `changeSides`, words),
  `ChangeLog.tsx` (filter bar, table, pager, Export through 652's `DownloadButton`), `general.ts` (`'changes'` tab +
  `changes` query), `api.ts` (`idfChangesApi`, `IDF_GENERAL_CHANGES_KEY` under `IDF_GENERAL_KEY`), i18n object `changes`
  + `general.tabs.changes` EN+AR.
- Settled myself (overrulable):
  - **No default window, no cap** — 3194 makes both ends optional; a bare tab reads the whole log (paged). One end
    alone is a window open at the other. Only `to` before `from` (and a non-day) is refused, on the screen, before any
    read; Export is disabled while it is.
  - **Before and After are two columns**, each one whole value (item: `IDF-IBU · 3` in an `Ltr` via `formatPair`;
    group: `description · dosageForm` in a `<bdi>` via `formatParts`; absent: "None"). One "before → after" cell
    would put two isolates on one line for RTL to swap.
  - **`before` / `after` are read defensively** (`changeSide`): `{ idfNumber, priority }` → item side; otherwise the
    group's `{ description, dosageForm }`; a string as it is; anything else as none. 654 to reconcile with the built shape.
  - `user` is a typed user id (exact), item/group typed too (applied on leaving the box, as 626/643 do).
  - Export fallback name `idf-general-changes[-yyyyMMdd][-to-yyyyMMdd].xlsx`; the export sends the filter without the page.
  - The stub's invented refusals are `IDF-00090` (to before from) and `IDF-00091` (export refused); the screen never
    branches on either.
