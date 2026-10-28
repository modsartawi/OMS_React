---
status: open
spec: BackOffice 3185 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md, section "Spec 3185")
blocked-by: 643, 644, 645, 646, 647, 648, 649, 650, 651, 652, 653
---

# 654 — The 3185 IDF screens call the live endpoints on staging

## What to build

Walk every 3185 screen against a staging SIS.Api once BackOffice 3187–3197 ship:

- reconcile every dated 3185 line under the [brief](C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md)'s
  **Changes** into the model and the stubs;
- grants: the draft actions check the IDF edit grant (`canEditIdf`); general-master and group writes check the new
  general-edit grant (`canEditGeneral` on `GET IdfPriority/Access`); reads stay on the view grant;
- an owner walk: one master edited through a draft and published; a stale draft rebased; one general item set and
  cleared; a general upload previewed and applied; the change log filtered; a group added, imported, and a non-empty
  group refused on remove.

## Spine reach

api (live) · component (probes) · drive (live)

## Proof (→ `tdd` red-green cycles)

- [ ] the 3185 IDF drives run live on staging, green · flow
- [ ] owner walk recorded in this ticket

## Boundaries

Depends on BackOffice 3187–3197 deployed to staging, with their DDL and the `IDF_GENERAL_EDITOR` grant seed applied.
Never publish a master or apply a general upload on prod from a drive.

## Done when

Every 3185 screen works live on staging with its grants, drift reconciled, owner walk recorded.

## Blocked by

[643](643-a-masters-page-lists-the-items-of-its-live-version-or-any-old-one.md) to
[653](653-idf-groups-import-in-bulk-with-a-row-report-and-apply-only-on-confirm.md)
