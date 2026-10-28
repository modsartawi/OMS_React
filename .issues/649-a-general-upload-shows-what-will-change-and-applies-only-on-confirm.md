---
status: done
spec: BackOffice 3185 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md, section "Spec 3185")
blocked-by: 647
---

# 649 — A general upload shows what will change, and applies only on confirm

## What to build

A bad general file reaches every till today. An **Upload** step on the General master page, doors BackOffice 3193
([brief](C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md), "Spec 3185"):

- pick a file; a failing file shows its row report (as 622) and cannot be applied;
- a clean file shows the **change preview**: counts of added / re-ranked / moved / unchanged, and a filterable table
  of each change, before → after;
- **Apply** asks for a reason; the result shows how many items were applied and lists any failed batch with its lines
  and message.

## Spine reach

api (multipart) · logic (applicable, preview filter) · component · i18n (EN+AR) · test + drive

## Proof (→ `tdd` red-green cycles)

- [x] `a general upload is applicable only when ok and no row failed` · pure
- [x] `preview filter by change kind` · pure
- [x] drive `tools/idf-general-upload-drive.mjs` — dirty file: report, Apply off; clean file: preview, apply with reason;
  a stubbed failed batch is listed · flow

## Boundaries

Endpoints stubbed. Reuse 622's row-report component. Needs the general-edit grant once 654 adds the probe.

## Done when

Against stubs, nothing applies until a clean preview is confirmed, proofs green.

## Blocked by

[647](647-the-masters-list-shows-general-and-its-page-lists-the-general-items.md)

## Done 2026-10-28

- Pure `general-upload.ts` (`isGeneralUploadApplicable` = 622's `isPublishable`; `previewRows(preview, kind|'')`;
  `previewSide` → `IDF-AMOX · 1` via `formatPair`; `failedBatchLines` → `201–400` via `formatRange`, one line when
  equal) — `general-upload.test.ts` 14/14 (both proofs). Doors `idfGeneralUploadApi.upload(file)` (multipart `file`, a
  null body → a report that never applies) + `.apply(uploadId, reason)` (POST `{ reason }`) in slot 649 of `api.ts` —
  `general-upload-doors.test.ts` 3/3. Keys: `i18n-keys.test.ts` (649 block); object `generalUpload` EN + AR (six AR forms).
- `GeneralUpload.tsx` at GeneralPage's `{/* 649 · Upload */}` slot: file → Upload and check → 653's `UploadRowReport`
  (`kind="item" keyPrefix="generalUpload"`, 622's rule words); a clean file adds the preview (a chip per kind with its
  count, All by default; table item / change / before / after, each side ONE `Ltr`, an added item "Not ranked").
  **Apply…** is off unless applicable → a Modal with a required reason (`reasonProblem`, 400 max, from exceptions.ts) →
  result "Items written: n" + a failed-batches table (lines one `Ltr` range, message `<bdi>`); the report clears,
  `IDF_GENERAL_KEY` is invalidated, a success toast. A refused apply stays in the dialog as an ErrorBanner.
- Stub `idfGeneralUploadStub` (slot 649): report by file name (`dirty` / `notok` / `batch` / clean), the preview
  computed against `state.general` (a re-check after apply reads unchanged), apply writes `state.general`; opts
  `generalUploads`, `refuseGeneralApply`; invented codes IDF-00085/86 (never branched on). Drive
  `tools/idf-general-upload-drive.mjs` 66/66 (LTR + RTL, default port 5215); `idf-upload-drive` 96/96 and
  `idf-general-drive` 48/48 re-run green. Gates: typecheck, lint, test.
- Settled myself (overrulable): the Upload is an inline card on the page (as 622), not a Modal; the reason reuses the
  exceptions' 400-char cap (the brief gives none); the preview shows only on a clean report; after an apply the report
  clears (the same upload cannot be applied twice from the screen); the chips show the server's counts, the table its
  `changes`.
