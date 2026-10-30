---
status: done
spec: BO 3271 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3271-oms-react-fhir-insurance-rules-brief.md)
blocked-by: —
---

# 706 — A workbook upload shows the label diff and the new change-log rows

## What to build

Story 63; L3–L5; doors 3295, 3296. A Code labels screen. A grant holder uploads a Nphies workbook and sees its version,
the labels that changed and the workbook's new change-log rows. An unknown layout or an older version is refused with
the door's message. Past loads are listed with who, when, the file hash and the version. No second approver.

**Decision (overrulable):** the upload accepts all three workbooks, following door 3296: Codeable Concept,
validation-rule and profiles. Spec 3271 says two, but the extension-URL refusal (695) needs the profiles sheet.

## Spine reach

model/api (upload, diff, load log) · store/logic (diff grouping) · component (upload, diff, log) · i18n (en + ar) ·
test (pure + drive)

## Proof (→ `tdd` red-green cycles)

- [x] diff grouping: added, changed, removed, and an empty diff — pure
- [x] upload a workbook, read its diff and change-log rows; an older version and an unknown layout are refused — flow

## Boundaries

The workbook is parsed by the door, never in the browser. Labels are shown as sent and are never translated. Doors
stubbed; 711 reconciles.

## Done when

A Nphies release can be reviewed in its own words the day its workbook arrives.

## Blocked by

None (can start immediately).

## Comments

**2026-10-30, built on stubs (drive `tools/insurance-fhir-706-drive.mjs`, stubs `tools/fhir-rules-stubs-706.mjs`).**

Door shapes guessed, for 711 to reconcile:

- `GET InsuranceRules/Labels/Workbooks` → past loads, newest first: `{ id, workbook, version, fileName, fileHash, uploadedBy, uploadedAt }`.
  `workbook` is `codeableConcept | validationRule | profiles`; another value is shown as sent.
- `POST InsuranceRules/Labels/Workbooks`, multipart `{ file }` only (the door reads which workbook from its layout), →
  `{ load, diff, changeLog }`.
- A `diff` row: `{ system, code, change: added|changed|removed, before: { en, ar }|null, after: { en, ar }|null }`.
- A `changeLog` row: `{ version, date, system, code, change }`, with `change` the workbook's sentence.
- Refusals: the envelope's `message` is shown; the screen does not branch on a code. The stubs use 409
  `WORKBOOK_OLDER_VERSION` and 400 `WORKBOOK_UNKNOWN_LAYOUT`.

Overrulable decisions:

- There is no door to reopen a past load's diff (none is specified), so the diff lives on screen until the next
  upload or leaving the page, and the log lists loads without opening them.
- A `change` the screen does not know reads as changed, so a sent row is never dropped.
- The route is `/insurance-rules/code-labels`, the namespace `insurance-labels` (one for 706–707), with no access probe
  (a bare 403 on the read is "You do not have access" and hides the upload).
- Arabic keys are proved mirrored by test only: `lng` stays `en`, so the drive's RTL pass reads English words under
  `dir=rtl`. The Arabic wording is unreviewed.
