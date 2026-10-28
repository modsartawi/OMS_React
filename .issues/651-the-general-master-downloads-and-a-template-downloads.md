---
status: done
spec: BackOffice 3185 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md, section "Spec 3185")
blocked-by: 644, 647
---

# 651 — The general master downloads, and a template downloads

## What to build

Doors BackOffice 3195 ([brief](C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md), "Spec 3185"):

- **Export** on the General master page downloads the whole general master as `.xlsx`;
- **Template** beside Upload downloads the blank file;
- both with 644's download helper.

## Spine reach

api (`api.blob`) · component · i18n (EN+AR) · drive

## Proof (→ `tdd` red-green cycles)

- [x] drive `tools/idf-general-drive.mjs` extended — Export and Template each download a file · flow

## Boundaries

Endpoints stubbed. View grant only.

## Done when

Against stubs, both downloads work from the General page, proof green.

## Blocked by

[644](644-a-master-downloads-in-its-upload-format-and-a-blank-template-downloads.md),
[647](647-the-masters-list-shows-general-and-its-page-lists-the-general-items.md)

## Done 2026-10-28

- Pure: `download.ts` slot 651 — `generalExportFileName()` → `idf-general.xlsx`, `generalTemplateFileName()` →
  `idf-general-template.xlsx` (fallbacks only; the server's `Content-Disposition` name wins). `download.test.ts` (651).
  Doors `idfGeneralFilesApi.export()` → `GET IdfPriority/general/export`, `.template()` → `GET IdfPriority/general/template`
  (slot 651 in `api.ts`, `api.blob`) — `doors.test.ts` (651).
- UI: 652's `DownloadButton` twice in the General page's action row (slot 651) — **Export** (`data-idf-general-export`)
  and **Template** (`data-idf-general-template`), with 644's shared `download.*` labels (no new keys, EN+AR already there).
- Stubs `// --- 651 ---` (`idfGeneralFilesStub`, `IDF_GENERAL_EXPORT_NAME`, `IDF_GENERAL_TEMPLATE_NAME`; `deny`
  `generalExport` / `generalTemplate` on invented codes IDF-00095 / IDF-00096, `noFileName`; `reads` counts).
- Drive `tools/idf-general-drive.mjs` extended (steps 7–9: both files save under the server's name, fallback names,
  refused → toast with the server's message and no file) — 70/70 LTR + RTL. Gates: typecheck, lint, test green.
- Settled myself (overrulable): Template sits in the action row beside Export, not beside 649's Upload block (built in
  parallel) — a one-line comment marks it for the review to move; a refused download is the toast `DownloadButton`
  already gives (644's ruling); Export is offered unconditionally (General has no versions, so nothing to gate on).
