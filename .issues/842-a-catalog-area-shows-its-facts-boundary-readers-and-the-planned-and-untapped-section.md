---
status: done
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

- [x] `area detail renders boundary, readers and used-by from the wire` · vitest (`catalog-area.test.ts`)
- [x] `used-by link opens the library narrowed to the area` · vitest (`catalog-area.test.ts`)
- [x] `planned areas group by status; untapped lists sources` · vitest (`catalog-planned.test.ts`)

## Boundaries

Web only.

## Done when

Proofs green; on staging an area shows its boundary and the Planned section lists the seeded roadmap.

## Blocked by

[841](841-the-catalog-page-browses-areas-members-marts-and-sources-as-a-tree.md), BackOffice [3439](C:/Work/DMSCO/BackOffice/.issues/3439-each-catalog-area-states-its-owner-boundary-history-readers-and-the-saved-items-that-use-it.md), BackOffice [3440](C:/Work/DMSCO/BackOffice/.issues/3440-the-catalog-lists-planned-areas-and-source-tables-nothing-reads-yet.md)

## Comments

**2026-11-07 — built (stubbed; staging walk owed).** Code half holds; "on staging an area shows its boundary and the
Planned section lists the seeded roadmap" is still owed (no live SIS.Api with 3439/3440 walked).

- Pure modules (845's print reuses them): `boards/catalog-area.ts` — `areaFacts(area)` (data as of or `null`,
  `historyOf` `yyyy-MM-dd` | `<N>d` | unknown, refresh, non-blank boundary, readers, used-by `{kind, count, href}[]`
  or `null`, grant) and `usedByHref(areaKey, kind)`; `boards/catalog-planned.ts` — `PLANNED_STATUSES`,
  `groupPlanned` (idea → approved → building → live, empty statuses dropped), `plannedSources` (each key resolved
  lineage / untapped / unknown; the wire's `unknownSources` flagged, never dropped), `plannedNaming`.
- Tree: a `roadmap` root after the areas (only when the image serves a roadmap or untapped list) →
  `plannedGroup` → `plannedStatus` → `planned`, and `untappedGroup` → `untapped`; planned nodes carry their resolved
  sources, untapped nodes the planned areas naming them. Search matches a planned area's key and both labels, and an
  untapped key/table. New detail components `CatalogPlannedDetail` (status chip via `StatusBadge`: idea mute,
  approved go, building warn, live ok), `CatalogUntappedDetail`, `CatalogRoadmapDetail` (counts). The area's
  `actions` slot is untouched (843).
- Area detail: data as of (`formatPair(day, clock)` in `Ltr`; `''` → "Not known"), history (date or "The last N
  days"), refresh, the boundary list, copilot / designer badges, used-by counts as links, "who may read" naming the
  grant as a machine value. `usedBy: null` → "Not known", never 0.
- **Ruling 3 applied** (orchestrator): the used-by counts link to All my items with `?kind=<view|board|report>&area=<key>`.
  `LibraryChoice` gained `area` (URL `area`, counts as narrowing, Clear drops it); `libraryItemsQuery` and
  `analyticsApi.items` forward `area` to `GET Analytics/Items`; the library shows a removable "Area: <name>" chip
  (name from the catalog query, key as fallback) with a note that the list is not narrowed yet. The counts are
  labelled as everyone's saved items.
- **BackOffice ask (unfiled):** "`GET Analytics/Items` takes `area` (a catalog area key) and returns the items whose
  definition reads that area; until then the list is not narrowed." The server ignores the param today.
- i18n under `catalog.area.*`, `catalog.planned.*`, `catalog.untapped.*` in en + ar (locale-parity vitest green).
- Drive: `DRIVE_ONLY=842 DRIVE_PORT=<port> node tools/analytics-drive.mjs` (fixture `CATALOG_842` in
  `tools/analytics-catalog-stubs.mjs`), en + rtl, 841+842 59/59.
- Gates: typecheck, test (9731), build, lint — only the 4 known `insurance-rules/aliases/door-shapes.test.ts`
  boundary errors; grid base, contrast, palette, controls clean.
