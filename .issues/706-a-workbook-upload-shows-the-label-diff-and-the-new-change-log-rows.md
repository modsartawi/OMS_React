---
status: open
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

- [ ] diff grouping: added, changed, removed, and an empty diff — pure
- [ ] upload a workbook, read its diff and change-log rows; an older version and an unknown layout are refused — flow

## Boundaries

The workbook is parsed by the door, never in the browser. Labels are shown as sent and are never translated. Doors
stubbed; 711 reconciles.

## Done when

A Nphies release can be reviewed in its own words the day its workbook arrives.

## Blocked by

None (can start immediately).

## Comments
