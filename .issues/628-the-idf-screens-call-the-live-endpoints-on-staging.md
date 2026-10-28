---
status: open
spec: BackOffice 3157 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md)
blocked-by: 619, 620, 621, 622, 623, 624, 625, 626, 627
---

# 628 — The IDF screens call the live endpoints on staging

## What to build

Walk every IDF leaf against a staging SIS.Api once BackOffice 3161, 3162, 3166, 3167, 3168 and 3169 ship:

- reconcile every dated line under the [brief](C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md)'s
  **Changes** into the model and the stubs;
- add the access probes: each leaf checks the IDF view grant, and the write actions (create / edit master, upload,
  publish, restore, exception changes, store-list changes) check the IDF write grant — following the probe pattern
  618 lands for the group;
- an owner walk: upload a sample with a bad row, fix it, publish, restore; one lookup per tier.

## Spine reach

api (live) · component (probes) · drive (live)

## Proof (→ `tdd` red-green cycles)

- [ ] the IDF drives run live on staging, green · flow
- [ ] owner walk recorded in this ticket

## Boundaries

Depends on BackOffice 3161, 3162, 3166, 3167, 3168, 3169 deployed to staging, and on the grant names they mint.
Never publish a master on prod from a drive.

## Done when

Every IDF leaf works live on staging with its grants, drift reconciled, owner walk recorded.

## Blocked by

[619](619-the-idf-masters-list-shows-each-masters-kind-scope-live-version-and-thresholds.md) to
[627](627-the-idf-swap-report-groups-by-master-store-and-payer-and-exports-to-excel.md); BackOffice 3161, 3162,
3166, 3167, 3168, 3169

## Open questions

- IDF requests (stories 15–17) are not minted: they wait on spec 3157 open question 1.
