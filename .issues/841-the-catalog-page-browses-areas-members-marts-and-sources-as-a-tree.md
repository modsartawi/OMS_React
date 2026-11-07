---
status: open
spec: C:/Work/DMSCO/BackOffice/.issues/3437-analytics-library-pages-and-the-data-catalog-spec.md
blocked-by: 839, BackOffice 3438
---

# 841 — The Catalog page browses area, members, marts and sources as a tree with search

oms-react half of BackOffice spec 3437 (`C:/Work/DMSCO/BackOffice/.issues/3437-analytics-library-pages-and-the-data-catalog-spec.md`), §G; the server spec is the normative wire.

## What to build

BackOffice spec 3437 §G (Catalog), user stories 17–21, 27–30.

- `/analytics/catalog` reads `GET Analytics/Catalog`. A tree on the start side: areas, then (Measures, Dimensions,
  Marts), then each mart's sources. A detail pane shows the selected node:
  - a measure: label, unit, shape, description, the dimensions it cannot be cut by;
  - a mart: description, grain, sources;
  - a source: server, database, table, and which marts use it.
- An unavailable area is shown greyed, with its reason. `lineageAvailable: false` shows "lineage not available on
  this image version" in place of the mart/source nodes.
- A search over names in both languages expands to the matches.
- Metadata only: nothing on this page queries figures.
- RTL-correct, bilingual (`boards` namespace), DMSCO tokens.

## Spine reach

UI / api / tests.

## Proof (→ `tdd` red-green cycles)

- [ ] `catalog tree builds area -> members -> marts -> sources from the wire` (pure tree builder) · vitest
- [ ] `search matches Arabic and English labels and expands ancestors` · vitest
- [ ] `lineage unavailable shows the note and keeps areas` · vitest

## Boundaries

Web only. Fields from 3439/3440 render when present (842).

## Done when

Proofs green; on staging all 13 areas browse down to their source tables.

## Blocked by

[839](839-the-analytics-menu-has-one-leaf-per-library-page.md), BackOffice [3438](C:/Work/DMSCO/BackOffice/.issues/3438-the-catalog-door-shows-each-area-with-the-marts-and-sources-the-deployed-image-built-it-from.md)
