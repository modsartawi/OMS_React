---
status: open
spec: BackOffice 3157 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md)
blocked-by: 619
---

# 626 — IDF events: a paged log filtered by store, payer, master, outcome and dates

## What to build

A leaf **IDF events** at `/insurance-rules/idf/events` (door 3167,
[brief](C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md)). `GET IdfPriority/events` with filters
from / to (local wall-clock), store, payer, master (from 619's list), outcome, and paging. Each row: when, store,
payer, document type, item scanned, item dispensed, deciding master + version, outcome, time spent.

Outcomes: reminder · forced pick taken · pick cancelled · line abandoned · skipped by exception · refused
(pre-authorisation). The reserved `requestRaised` / `autoApproved` get display words but are not offered in the
outcome filter until IDF requests exist. Filters live in the URL.

## Spine reach

model/api · logic (filter → query, outcome words) · component/route · i18n (EN+AR) · test + drive

## Proof (→ `tdd` red-green cycles)

- [ ] `events filter builds the query and drops empty fields` · pure
- [ ] `every outcome, reserved ones too, has a word` · pure
- [ ] drive `tools/idf-events-drive.mjs` — filter by outcome and master, page 2, empty state · flow

## Boundaries

New endpoint `GET IdfPriority/events` — stubbed; the paged shape is 3167's to finalise. Keys in `insurance-idf`.
Ungated until 628. Grid cells are isolated by the grid base.

## Done when

The stubbed event log filters and pages, proofs green.

## Blocked by

[619](619-the-idf-masters-list-shows-each-masters-kind-scope-live-version-and-thresholds.md)
