---
status: done
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

- [x] `catalog tree builds area -> members -> marts -> sources from the wire` (pure tree builder) · vitest — `boards/catalog-tree.test.ts`
- [x] `search matches Arabic and English labels and expands ancestors` · vitest — `boards/catalog-search.test.ts`
- [x] `lineage unavailable shows the note and keeps areas` · vitest — `boards/catalog-tree.test.ts` (green on first run: cycle 1's builder already put the note node in place of the Marts group)

## Boundaries

Web only. Fields from 3439/3440 render when present (842).

## Done when

Proofs green; on staging all 13 areas browse down to their source tables.

## Blocked by

[839](839-the-analytics-menu-has-one-leaf-per-library-page.md), BackOffice [3438](C:/Work/DMSCO/BackOffice/.issues/3438-the-catalog-door-shows-each-area-with-the-marts-and-sources-the-deployed-image-built-it-from.md)

## Comments

**2026-11-07 — built (code half), stubbed. Staging walk owed:** "on staging all 13 areas browse down to their
source tables".

- Wire: `GET Analytics/Catalog` read by `boards/catalog-wire.ts` (`readCatalog`) against the BUILT shape (BO
  spec3437 `AnalyticsCatalog.cs`), 3439/3440 fields included (owner, dataAsOf, historyStart, refresh, boundary,
  readBy, usedBy, access, planned, untappedSources) — read and typed in `src/core/models/analytics.ts` ("Spec 3437"
  section), not rendered yet (842). Under a held render ticket `analyticsApi.catalog()` reads
  `Analytics/Render/Catalog` (for 845).
- Tree (`boards/catalog-tree.ts`, pure): area → Measures / Dimensions / Marts groups → mart → sources. Path ids
  (`area:k/mart:m/source:s`), so a mart shared by two areas is two nodes. A mart/source key the lineage does not
  describe is kept and shown by key ("not described"). `lineageAvailable: false` → a `lineageNote` node in place of
  each area's Marts group plus a page note; areas, measures and dimensions kept.
- Search (`boards/catalog-search.ts`, pure): labels in en AND ar folded with `home.ts` `fold` (no harakat or tatweel,
  any case), plus machine keys and source table names. It opens each match's ancestors; while a search stands only
  matches, their ancestors and what lies under a match are drawn.
- Detail pane: one component per kind (`CatalogAreaDetail`, `CatalogMeasureDetail`, `CatalogDimensionDetail`,
  `CatalogMartDetail`, `CatalogSourceDetail`) behind the `CatalogDetail` switch, each passing an `actions` slot to
  `DetailShell` (`CatalogDetailParts.tsx`) for 843/844. "Cannot be cut by" = the area's dimensions minus the
  measure's (`cannotCutBy`; there is no `notBy` on the wire).
- Ruling (orchestrator, binding): the area `unavailableReason` is a Label `{en, ar}` on the wire. Fixed here:
  `AnalyticsArea.unavailableReason` is `AnalyticsLabel | null`, `readModel` reads it with `readReason` (a bare string
  reads as English), and MeasurePicker, panel-state and editor-refusal render it through `saysIn`. The drive's stub
  MODEL now sends a label.
- Ruling (orchestrator 8): mart/source descriptions, grain and owner are English server text, rendered in `<bdi>`,
  not keyed.
- Only shared controls (`Button variant="text"`, `IconButton`, `Input`); the `analytics/boards` control ceiling stays
  0. Tree rows are `role="treeitem"` with `aria-expanded` / `aria-selected` / `aria-level`; indentation `ps-*`, the
  chevron `rtl:rotate-180`.
- Drive: `DRIVE_ONLY=841 DRIVE_PORT=5199 node tools/analytics-drive.mjs` (fixtures in
  `tools/analytics-catalog-stubs.mjs`), en + rtl, 29/29. 839's Catalog check now expects the page, not the
  placeholder. The drive's rtl run flips direction but keeps English copy, so the Arabic wording is covered by the
  locale-parity vitest (`catalog-locale.test.ts`), not on screen.
- Gates: typecheck, test, build, lint — only the 4 known `insurance-rules/aliases/door-shapes.test.ts` boundary
  errors.
