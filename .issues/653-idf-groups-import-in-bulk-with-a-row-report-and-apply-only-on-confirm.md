---
status: done
spec: BackOffice 3185 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md, section "Spec 3185")
blocked-by: —
---

# 653 — IDF groups import in bulk with a row report, and apply only on confirm

## What to build

A bad groups file must never reach the tills. An **Import** step on the IDF groups leaf, doors BackOffice 3197
([brief](C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md), "Spec 3185"):

- **Template** downloads the blank file;
- pick a file; the report lists every row with its action (add / update) and, on a failing row, the rule's message;
- **Apply** is off unless the report is clean; the result shows how many were added and updated, and the list
  refreshes.

## Spine reach

api (multipart) · logic (applicable, counts) · component · i18n (EN+AR) · test + drive

## Proof (→ `tdd` red-green cycles)

- [x] `a groups import is applicable only when ok and no row failed; add/update counts` · pure
- [x] drive `tools/idf-groups-drive.mjs` extended — dirty file: report, Apply off; clean file with an update: applied ·
  flow

## Boundaries

Endpoints stubbed. Reuse 622's row-report component. Needs the general-edit grant once 654 adds the probe.

## Done when

Against stubs, a dirty file applies nothing and a clean one applies, proofs green.

## Blocked by

[652](652-the-idf-groups-leaf-lists-adds-edits-exports-and-removes-only-empty-groups.md)

## Done (2026-10-28)

- Pure `groups-import.ts` (`isGroupsImportApplicable` = ok && uploadId && ≥ 1 row && no row names a rule;
  `groupsImportCounts` add / update / failed; `IDF_GROUPS_IMPORT_RULES` + `groupsImportRuleWordKey`) —
  `groups-import.test.ts` 9/9. Doors `idfGroupsImportApi.upload(file)` (multipart `file`, a null body → a report that
  never applies) + `.apply(uploadId)` (POST `{}`) in slot 653 of `api.ts` — `groups-doors.test.ts` +2.
- 622's private `Report` extracted from `MasterPage.tsx` into **`UploadRowReport.tsx`**
  (`{ report, kind: 'item'|'group', applicable, ruleWordKey, keyPrefix, summary? }`; words read under `keyPrefix`; all
  622 hooks kept). MasterPage renders it with `kind="item" keyPrefix="upload" applicable={isPublishable(report)}` —
  `tools/idf-upload-drive.mjs` re-run 96/96.
- `GroupsImport.tsx` at GroupsPage's `{/* 653 · Template + Import */}` slot: Template (`DownloadButton`,
  `data-idf-groups-template`) + Import button → a Modal: file → Upload and check → every row with its action, failing
  rows' rule + message; Apply off unless clean; result (added / updated) shown in the dialog, success toast,
  `IDF_GROUPS_KEY` invalidated; a refused apply is an inline ErrorBanner. i18n object `groupsImport` EN+AR (+ test).
- Stub `idfGroupsImportStub` (slot 653, chained after 652's): report by file name (`dirty` / `notok` / clean), apply
  writes into `state.groups`; opt `refuseGroupsApply`. Drive `tools/idf-groups-drive.mjs` 100/100 (LTR + RTL), 9–13 new.
  Gates: typecheck, lint, test (7395) green.
- Settled myself (overrulable): Import lives in a Modal (one hunk in GroupsPage, the slot); an `ok` report with ZERO
  rows does not apply (an empty file writes nothing); a passing row shows no rule and no message; failing group rows
  get a faint destructive tint; the clean/failed status line is followed by the add/update counts in both states.
