---
status: done
spec: C:/Work/DMSCO/BackOffice/.issues/3437-analytics-library-pages-and-the-data-catalog-spec.md
blocked-by: 842, BackOffice 3444
---

# 845 — The catalog prints as a bilingual PDF

oms-react half of BackOffice spec 3437 (`C:/Work/DMSCO/BackOffice/.issues/3437-analytics-library-pages-and-the-data-catalog-spec.md`), §G; the server spec is the normative wire.

## What to build

BackOffice spec 3437 §G (print), user story 52.

- A catalog **print route**, the `/analytics/print/…` family under a render ticket, outside the shell. Per area: what
  it holds (measures and dimensions), sources, freshness, boundary; then the Planned and untapped section. It is
  laid out in both languages, A4, and RTL-correct for Arabic.
- A **Print** button on the Catalog page calls `POST Analytics/Catalog/Render` and downloads the PDF.

## Spine reach

UI (print route) / api / tests.

## Proof (→ `tdd` red-green cycles)

- [x] `print route renders every area and the planned section from the wire` · vitest
- [x] `print route never asks the access probe under a render ticket` · vitest

## Boundaries

Web only.

## Done when

Proofs green; a staging render yields a PDF management can read.

## Blocked by

[842](842-a-catalog-area-shows-its-facts-boundary-readers-and-the-planned-and-untapped-section.md), BackOffice [3444](C:/Work/DMSCO/BackOffice/.issues/3444-the-catalog-print-route-renders-under-a-ticket.md)

## Comments

**2026-11-07 — built (code half; staging render owed).**

- Pure module `boards/catalog-print.ts`: `catalogPrint(catalog)` (every area in wire order with `areaFacts`, its marts
  — unknown mart keys kept as `missingMarts` —, the source tables its marts read, once each, unresolved keys kept;
  then the Planned and untapped section via 842's `groupPlanned`/`plannedSources`), `catalogPrintQueries()` (the
  page's ONLY read), `pdfRefusal` (408 → `catalog.print.timedOut`, 409 → `catalog.print.failed`, else as every door),
  `catalogPdfName`. Proofs in `catalog-print.test.ts` (vitest, `@/core/api` stubbed); the probe proof asserts that
  under a ticket the page's reads are exactly one `GET Analytics/Render/Catalog` with the ticket header.
- Print route `/analytics/print/catalog` (`AnalyticsCatalogPrintPage.tsx`), top-level beside the report print route,
  same `ReportPrintGuard`; A4 (`PAPER_PX`, `@page` with `var(--card)`), `[break-inside:avoid]` per area, Planned
  section on a new page; `data-print-ready` once idle (ticket) or `window.print()` (a person).
- Core: `api.postJsonBlob(path, body)` in `src/core/api.ts` (+ two `api.test.ts` cases). `analyticsApi.catalogPdf(lang)`.
- Catalog page: `CatalogPrintActions.tsx` in the toolbar — "PDF in English" / "PDF in Arabic"; saves the server's
  file name (fallback `catalog.pdf` / `catalog-ar.pdf`); refusals toast `pdfRefusal` words.
- `History` exported from `CatalogAreaDetail.tsx` so paper and screen word history the same.
- Drive: `DRIVE_ONLY=845` (stubs gained `Analytics/Render/Catalog` — header checked, `ticketsSeen` — and
  `Analytics/Catalog/Render`), 20/20 en+rtl.

Rulings applied: **6** — one render per language (`{ lang }`), the Print control offers both; JSON blob helper in
`@/core/api`; the page reads only `Render/Catalog` (no probe, no model); curator facts (rows, size, hidden columns)
drawn by data presence, with a one-line curator note. **8** — mart grain/description, source description and
untapped note in `<bdi>`, not keyed. **13** — PDF-specific 408/409 words, en+ar.

Decision: the paper sets `<html dir>` from the ticket's language. Direction is a boot fact from `oms.locale`, which
the renderer's fresh profile lacks, so an Arabic paper would otherwise lay out LTR (the drive caught it). Safe live
here because the page mounts no grid. ⚠ The report print page (835) has the same gap for Arabic scheduled runs —
not touched here; worth a follow-up.

Not done: a 401 under a bad ticket still goes through `handle401` → `/login` (as the report print page); the
renderer then hits its budget (408). Unchanged, not made worse.

Owed: a staging render (`POST Analytics/Catalog/Render` en + ar against BO 3444 on spec3437) that management can read.
