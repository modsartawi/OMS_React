---
status: open
spec: BackOffice 3185 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md, section "Spec 3185")
blocked-by: 652
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

- [ ] `a groups import is applicable only when ok and no row failed; add/update counts` · pure
- [ ] drive `tools/idf-groups-drive.mjs` extended — dirty file: report, Apply off; clean file with an update: applied ·
  flow

## Boundaries

Endpoints stubbed. Reuse 622's row-report component. Needs the general-edit grant once 654 adds the probe.

## Done when

Against stubs, a dirty file applies nothing and a clean one applies, proofs green.

## Blocked by

[652](652-the-idf-groups-leaf-lists-adds-edits-exports-and-removes-only-empty-groups.md)
