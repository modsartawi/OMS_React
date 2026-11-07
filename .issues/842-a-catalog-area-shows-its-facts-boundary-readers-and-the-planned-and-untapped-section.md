---
status: open
spec: C:/Work/DMSCO/BackOffice/.issues/3437-analytics-library-pages-and-the-data-catalog-spec.md
blocked-by: 841, BackOffice 3439, BackOffice 3440
---

# 842 — A catalog area shows its facts, boundary, readers and used-by link, and the Planned and untapped section

oms-react half of BackOffice spec 3437 (`C:/Work/DMSCO/BackOffice/.issues/3437-analytics-library-pages-and-the-data-catalog-spec.md`), §G; the server spec is the normative wire.

## What to build

BackOffice spec 3437 §G, user stories 22–26, 31–33, 53.

- The area detail pane shows:
  - data as of, history start, refresh, owner, description;
  - the **boundary** list;
  - **copilot / designer** badges;
  - **used by** counts, each linking to the library narrowed to that area's items;
  - the "who may read" line (today's `AnalyticsView`).
- A **Planned / untapped** section in the tree: planned areas with a status chip (idea, approved, building, live),
  their questions and sources, and the untapped source tables with their notes.

## Spine reach

UI / tests.

## Proof (→ `tdd` red-green cycles)

- [ ] `area detail renders boundary, readers and used-by from the wire` · vitest
- [ ] `used-by link opens the library narrowed to the area` · vitest
- [ ] `planned areas group by status; untapped lists sources` · vitest

## Boundaries

Web only.

## Done when

Proofs green; on staging an area shows its boundary and the Planned section lists the seeded roadmap.

## Blocked by

[841](841-the-catalog-page-browses-areas-members-marts-and-sources-as-a-tree.md), BackOffice [3439](C:/Work/DMSCO/BackOffice/.issues/3439-each-catalog-area-states-its-owner-boundary-history-readers-and-the-saved-items-that-use-it.md), BackOffice [3440](C:/Work/DMSCO/BackOffice/.issues/3440-the-catalog-lists-planned-areas-and-source-tables-nothing-reads-yet.md)
