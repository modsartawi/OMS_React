---
status: open
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

- [ ] `couponCsv_rowCheck_flagsDuplicatesAndBadCodes` · pure
- [ ] drive: import (one bad row shown, rest imported), export, delete unused keeps used (stubbed) · flow

## Boundaries

Provisional endpoints (BackOffice 2755), stubbed. An export writes no bidi isolates (`stripIsolates`).

## Done when

The drive imports, exports and deletes unused codes against stubs.

## Blocked by

[515](515-a-coupon-campaign-creates-random-universal-or-personal-batches-with-the-batch-id-shown.md)
