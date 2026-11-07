---
status: open
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

- [ ] `print route renders every area and the planned section from the wire` · vitest
- [ ] `print route never asks the access probe under a render ticket` · vitest

## Boundaries

Web only.

## Done when

Proofs green; a staging render yields a PDF management can read.

## Blocked by

[842](842-a-catalog-area-shows-its-facts-boundary-readers-and-the-planned-and-untapped-section.md), BackOffice [3444](C:/Work/DMSCO/BackOffice/.issues/3444-the-catalog-print-route-renders-under-a-ticket.md)
