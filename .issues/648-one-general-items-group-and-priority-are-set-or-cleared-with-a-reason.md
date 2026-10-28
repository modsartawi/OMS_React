---
status: done
spec: BackOffice 3185 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md, section "Spec 3185")
blocked-by: 647
---

# 648 — One general item's group and priority are set or cleared with a reason

## What to build

A single fix to the general master needs no file. Doors BackOffice 3192
([brief](C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md), "Spec 3185"):

- an **Edit** action on a general items row, and **Set item** for an item not yet in the master: group, priority and a
  required reason; Save is off until all three are valid (priority a whole number of 1 or more);
- a **Clear** action asks for a reason;
- a refusal shows its message; a success refreshes the row.

## Spine reach

api · logic (form validity) · component (dialog) · i18n (EN+AR) · test + drive

## Proof (→ `tdd` red-green cycles)

- [x] `general edit form is valid only with a group, a whole priority ≥ 1 and a reason` · pure
- [x] drive `tools/idf-general-drive.mjs` extended — set, re-rank and clear one item; a refused group shows its message ·
  flow

## Boundaries

Endpoints stubbed. Needs the general-edit grant (`canEditGeneral`) once 654 adds the probe.

## Done when

Against stubs, one item is set, changed and cleared with a reason, proofs green.

## Blocked by

[647](647-the-masters-list-shows-general-and-its-page-lists-the-general-items.md)

## Done 2026-10-28

- Pure: `general-edit.test.ts` (the proof `general edit form is valid only with a group, a whole priority ≥ 1 and a
  reason`, plus Set item's item number, the edit's start from the row, the trimmed body); door shape in
  `doors.test.ts` (648: `PUT …/general/items/{n} { idfNumber, priority, reason }`, `DELETE … { reason }` in the body
  via `delWithBody`); keys in `i18n-keys.test.ts` (648, object `generalEdit` EN+AR).
- Drive: `tools/idf-general-drive.mjs` 76/76 (LTR + RTL; 647's 48 + 28 for 648) against stubs (`// --- 648 ---` in
  `tools/idf-stubs.mjs`: `idfGeneralEditStub` edits `state.general`, writes land in `opts.writes`; refusals
  `IDF-00080` blank reason / bad priority, `IDF-00081` unknown group, `IDF-00082` clear of an item not held).
- UI: `GeneralItemDialog.tsx` — `GeneralItemDialog` (Set item blank with the item number typed; Edit prefilled, item
  fixed) and `ClearGeneralItemDialog` (reason only). Set item in the page's action row; Edit / Clear per row through
  `ItemsTable`'s `actions`. Success toasts and invalidates `IDF_GENERAL_KEY`; a refusal stays in the dialog
  (`ErrorBanner`, the server's message; a bare 403 says "no access").
- Settled myself (overrulable): the group is a typed box, not a picker (the general items carry groups the 652 list
  may not hold, and the door is the judge of a group); the reason reuses 624's `reasonProblem` (400 max — the brief
  names none); Save / Clear are disabled until valid and a field's problem shows once it was typed in; a Set item for
  an item already held simply re-ranks it (one door); no gate until 654 (`canEditGeneral`).
