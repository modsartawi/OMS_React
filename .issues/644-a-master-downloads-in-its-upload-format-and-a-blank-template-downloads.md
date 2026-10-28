---
status: done
spec: BackOffice 3185 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md, section "Spec 3185")
blocked-by: 643
---

# 644 — A master downloads in its upload format, and a blank template downloads

## What to build

Bulk add and remove should start from the current ranking. Doors BackOffice 3188
([brief](C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md), "Spec 3185"):

- **Export** beside the Items section downloads the version on show (live or old) as `.xlsx`;
- **Template** beside Upload downloads the blank file;
- file names name the master and the version; a refused download (JSON envelope) shows its message.

## Spine reach

api (`api.blob`, as 627's export) · component · i18n (EN+AR) · test + drive

## Proof (→ `tdd` red-green cycles)

- [x] `export file name names the master and version` · pure
- [x] drive `tools/idf-export-drive.mjs` — Export and Template each download a file; a refused export shows its message ·
  flow

## Boundaries

Endpoints stubbed. The download helper is shared with 651 and 652.

## Done when

Against stubs, both downloads work from the master page, proofs green.

## Blocked by

[643](643-a-masters-page-lists-the-items-of-its-live-version-or-any-old-one.md)

## Done 2026-10-28

- Pure: `download.ts` slot 644 — `masterExportFileName(masterId, { versionId, number? })` → `idf-master-<id>-v<n>.xlsx`
  (the version id when the number is unknown; non-ASCII-safe characters become a dash), `masterTemplateFileName()` →
  `idf-master-template.xlsx`. `download.test.ts` 4/4 (new file, slot comments for 650/651/652). Doors
  `idfMasterFilesApi.export(masterId, versionId)` / `.template()` (slot 644 in `api.ts`) — `doors.test.ts` (644);
  keys in `i18n-keys.test.ts` (644).
- UI: 652's `DownloadButton` twice — **Export** (`data-idf-master-export`) in the Items section's toolbar, exporting
  `entriesVersionId` (the version on show, live or old; absent when the master has no live version); **Template**
  (`data-idf-master-template`) in the Upload step's file row. i18n object `download` (`export`, `exportFailed`,
  `template`, `templateFailed`) EN+AR — generic, so 651 can reuse the labels.
- Stubs `// --- 644 ---` (`idfMasterFilesStub`, `IDF_MASTER_EXPORT_NAME`, `IDF_MASTER_TEMPLATE_NAME`; `deny`
  `masterExport` / `masterTemplate`, `noFileName`). Drive `tools/idf-export-drive.mjs` (default 5212) 36/36 LTR + RTL;
  `idf-items-drive` 60/60, `idf-upload-drive` 96/96 still green. Gates: typecheck, lint, test green.
- Settled myself (overrulable): a refused download is an error toast carrying the server's message (652's
  `DownloadButton`), not an inline banner; the template is offered even on a master never published; the fallback
  name uses the master's id, never its display name.
