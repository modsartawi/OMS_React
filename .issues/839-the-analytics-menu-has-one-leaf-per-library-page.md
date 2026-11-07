---
status: open
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

- [ ] `menu lists eight analytics leaves behind the analytics probe` · vitest
- [ ] `each leaf narrows the library by its route` (pure `library` + route params) · vitest
- [ ] `old who/kind links redirect to the matching leaf` · vitest
- [ ] `Shared with me excludes my items and certified` · vitest

## Boundaries

Web only. No flag.

## Done when

Proofs green; on staging each leaf shows the right subset and a bookmarked old link lands on its leaf.

## Blocked by

None — can start immediately (the Items door's who/kind/folder params exist, 3432)
