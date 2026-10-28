---
status: open
spec: BackOffice 3185 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md, section "Spec 3185")
blocked-by: —
---

# 643 — A master's page lists the items of its live version, or of any old one

## What to build

Today a master's ranking cannot be seen. An **Items** section on the master page
(`/insurance-rules/idf/masters/:masterId`), doors BackOffice 3187
([brief](C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md), "Spec 3185"):

- a paged table of the live version: item, description (reader's language), IDF group, priority;
- a group filter and an item search (number or description), kept in the URL;
- a version picker fed by the existing Versions section: choosing an old version shows its items, clearly marked as
  not live;
- an empty state for a master with no live version yet.

## Spine reach

model/api (`…/versions/{versionId}/entries`) · logic (query params) · component (MasterPage section) · i18n (EN+AR) ·
test + drive

## Proof (→ `tdd` red-green cycles)

- [ ] `entries query keeps search, group and page, and resets page on a new filter` · pure
- [ ] drive `tools/idf-items-drive.mjs` — the live version's items show, filter and page; picking an old version shows
  its ranking marked not live (LTR + RTL) · flow

## Boundaries

New endpoint stubbed in `tools/idf-stubs.mjs`. Keys in `insurance-idf`. Item numbers and groups are machine values
(`Ltr`); descriptions free text (`<bdi>`).

## Done when

Against stubs, the master page shows any version's items with filter, search and paging, proofs green.

## Blocked by

None (can start immediately).
