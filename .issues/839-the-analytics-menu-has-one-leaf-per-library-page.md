---
status: done
spec: C:/Work/DMSCO/BackOffice/.issues/3437-analytics-library-pages-and-the-data-catalog-spec.md
blocked-by: —
---

# 839 — The Analytics menu has one leaf per library page, each a routed, pre-narrowed library

oms-react half of BackOffice spec 3437 (`C:/Work/DMSCO/BackOffice/.issues/3437-analytics-library-pages-and-the-data-catalog-spec.md`), §G; the server spec is the normative wire.

## What to build

BackOffice spec 3437 §G (menu, library leaves), user stories 1–2, 8–15.

- The Analytics menu group gets eight leaves, all on the same `canView` probe: Home `/analytics`, My boards
  `/analytics/boards`, My views `/analytics/views`, My reports `/analytics/reports`, Shared with me
  `/analytics/shared`, Certified `/analytics/certified`, Catalog `/analytics/catalog`, Recently deleted
  `/analytics/deleted`.
- Each library leaf is the existing library, with its route fixing who / kind / folder:
  - My boards / views / reports: `who=mine`, kind fixed;
  - Shared with me: shared and not mine;
  - Certified: certified;
  - Recently deleted: the deleted folder.

  The other chips, the search and the folder rail (on the "My" pages; folders shared across kinds) stay.
- Until 840 lands, Home keeps today's all-items library. Until 841, Catalog is a placeholder ("coming").
- The old `/analytics?who=…&kind=…` (and `folder=deleted`) redirect to the matching leaf.
- The singular item routes are unchanged. Each leaf lights only itself; item pages keep the group lit.
- Runners see no New buttons (unchanged). All labels go in `boards`, en and ar.

## Spine reach

UI (menu, router, library) / tests.

## Proof (→ `tdd` red-green cycles)

- [x] `menu lists eight analytics leaves behind the analytics probe` · vitest
- [x] `each leaf narrows the library by its route` (pure `library` + route params) · vitest
- [x] `old who/kind links redirect to the matching leaf` · vitest
- [x] `Shared with me excludes my items and certified` · vitest

## Boundaries

Web only. No flag.

## Done when

Proofs green; on staging each leaf shows the right subset and a bookmarked old link lands on its leaf.

## Blocked by

None — can start immediately (the Items door's who/kind/folder params exist, 3432)

## Comments

**2026-11-07 — code half done (impl/839).** The four Proofs are vitest: `src/layout/menu-analytics.test.ts`
(eight leaves, one probe, each leaf lights only itself, an item page lights Home) and
`src/features/analytics/boards/library-pages.test.ts` (route narrowing, URL keeps only what the route leaves open,
redirects, Shared excludes mine + certified — mutation-checked by breaking `whoMatches` once). Drive scenario
`839` in `tools/analytics-drive.mjs` (stubbed doors), 25/25 en + rtl.

- Pure module `features/analytics/boards/library-pages.ts`: `LIBRARY_PAGES` (page, path, labelKey),
  `libraryPagePath`, `pageChoice`, `pageToParams`, `pageQuery`, `pageShows`, `pageNarrows`, `libraryRedirect`.
- One library component `AnalyticsLibraryPage` (renamed from `AnalyticsHomePage`) takes `page`; Home still the
  whole library (840 replaces it). `AnalyticsCatalogPage` is the "coming" placeholder (841 replaces it).
- Decisions the spec left open: the redirect is a route loader on every library route and every navigation, so a
  Home chip pick that equals a leaf's slice (Mine+Boards, Certified, Shared with me, Recently deleted) lands on that
  leaf; `who=mine` of every kind, or a kind alone, has no leaf and stays on Home. Shared / Certified fix
  `folder=all` (folders are mine) and show no rail; Recently deleted shows no rail but keeps the who/kind chips; a
  My page's rail "Recently deleted" goes to `/analytics/deleted?kind=<its kind>`. Home keeps the ask box, every
  New button and the status card; a My page offers only its kind's New; Shared / Certified / Deleted none.
- **Owed:** the staging walk (each leaf's subset, a bookmarked old link landing on its leaf). BO 3437's doors are
  not deployed; the Items params this uses (3432) already are.
