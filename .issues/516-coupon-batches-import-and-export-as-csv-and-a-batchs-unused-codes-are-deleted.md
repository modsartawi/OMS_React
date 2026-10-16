---
status: done
spec: BO 2737 (brief C:\Work\DMSCO\BackOffice\.issues\assets\2737-oms-react-rule-engine-brief.md)
blocked-by: 515
---

# 516 — Coupon batches import and export as CSV, and a batch's unused codes are deleted

## What to build

On the Coupons page:

- **Import CSV:** by file, drag-and-drop or paste, with a per-row check (duplicate, bad characters, unknown
  member) before importing, and a result with the batch id.
- **Export CSV:** the filtered list or one batch.
- **Delete unused:** removes a batch's **unused** codes after a confirmation that shows the counts, and the used
  codes stay.

## Spine reach

model/api (import, export, delete unused) · logic (CSV row check) · component (dialogs) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `couponCsv_rowCheck_flagsDuplicatesAndBadCodes` · pure — `src/features/campaigns/workspace/coupon-csv.test.ts` (plus header/separator reading, HQ check + batch cap, export round-trip with no isolates; `src/core/util/csv-cells.test.ts`)
- [x] drive: import (one bad row shown, rest imported), export, delete unused keeps used (stubbed) · flow — `tools/campaigns-drive.mjs` §516 (checks 124–134): file / drop / paste import with every row reason, export of all / filtered / one batch (BOM, no isolates), delete unused with the counts, refusals. Full drive 596/596 against stubs (no live SIS.Api).

## Boundaries

Provisional endpoints (BackOffice 2755), stubbed. An export writes no bidi isolates (`stripIsolates`).

## Done when

The drive imports, exports and deletes unused codes against stubs.

## Blocked by

[515](515-a-coupon-campaign-creates-random-universal-or-personal-batches-with-the-batch-id-shown.md)

## Outcome (2026-10-16)

Built AFK. Coupons page gains Import CSV (file, drop or paste → local row check: missing code, bad characters, repeat
in the file, already in the campaign; then HQ's provisional import check: code held in SIS.Coupons, unknown member;
rejected rows shown with their reason and left out; success modal with the batch id and the rows left out), Export
(the list as filtered, or one batch from the success modal; machine header, BOM, CRLF, `stripIsolates`) and, with a
batch filtered, Delete unused (confirmation with the unused that go and the used / disabled / expired that stay).
Provisional doors `…/Coupons/Imports/Check`, `…/Coupons/Imports`, `DELETE …/Coupons/Batches/{b}/Unused` in
`src/core/rules/api.ts`. The CSV cell reader graduated to `src/core/util/csv-cells.ts` (the simulator's basket reader
now uses it too).

Outstanding (not AFK's): the live door walk (ticket 520, BackOffice 2755); owner sign-off on `.afk/HITL-516.md`
(one-batch Delete unused vs the prototype's campaign-wide one; the invented pre-import check door; export layout).
Review notes deferred: the CSV cell *writer* is now a third copy in the repo (could graduate beside `csvCells`); the
`badCode` copy repeats the 3–32 length bound of the code pattern.
