---
status: done
spec: BackOffice 4182
blocked-by: 951
---

# 953 — The whole help prints in one language, with a cover, contents and page numbers

Spec: BackOffice `C:\Work\DMSCO\BackOffice\.issues\4182-the-analytics-help-center-in-english-and-arabic-read-by-the-copilot-spec.md`.

## What to build

- **A print route,** `/analytics/print/help?lang=en|ar`, a sibling of `/analytics/print/report/:id` and
  `/analytics/print/catalog`, in the same print layout without the app shell.
- **The cover:** the title "Analytics: user guide", the language, the "checked against" line, the print date, and a
  Draft watermark while the area is draft.
- **The contents:** every article with its access badge and page number. Page numbers come from CSS counters, with
  the page number in the footer.
- **The articles in order,** each starting on a new page. Images are kept whole across page breaks, and no heading
  is left alone at a page bottom.
- **Links print as text:** `screen:` links print as the screen's name, and `help:` links as "see <article title>".
- **Arabic prints right-to-left** with the app's Arabic font.
- **It sets `data-print-ready`** once every image has loaded (or failed), like the other print pages, so it can be
  rendered headless later by the renderer pattern in SIS.Api. It never opens the print dialog itself.
- **A "Print the guide" button** on the help center opens the route in a new tab, in the app's language.

## Spine reach

UI (print route, print styles)

## Proof (→ `tdd` red-green cycles)

- [x] Every article of the contents is rendered in order, each in its own page block · vitest
- [x] `data-print-ready` appears only after every image has settled · vitest
- [x] The Draft watermark shows only while draft · vitest
- [x] Links print as text · vitest
- [x] Manual: Save as PDF in both languages, then read the result; record the page count and any clipped image in
      Comments

## Boundaries

No server-made PDF. The launch PDFs are made with the browser's Save as PDF (BO 4187).

## Done when

The proofs are green, and on dev both languages save as a clean PDF with BO 4183's articles.

## Blocked by

[951](951-the-help-center-lists-an-areas-articles-searches-them-and-reads-one-in-the-apps-language.md)

## Comments

- 2026-11-22 (/implement-spec): Built on spec/4182-help-center (e5ac004a, merge 4ba95306; review fixes 374f10f6), **stubbed**. 4 vitest proofs green; `tools/help-print-drive.mjs` 13/13 on a stubbed endpoint. **Owed:** the manual Save-as-PDF in both languages on dev (page count, clipped images). Contents page numbers are computed (`contentsPageNumbers`, A4 measured on screen) since Chromium lacks `target-counter()`; a pushed picture/heading can shift an article by one page. Defaults: print language from `?lang=` only; contents shows the access level only; a failed article prints its heading and does not block; margins 14/14/16 mm.
- 2026-11-23: reconciled with BO pricing2 @ 98f9a5ad9 (83b780a7); `tools/help-print-drive.mjs` 13/13. Save-as-PDF on the real 14 articles still owed.
- 2026-11-23: **PDF proof run** (headless Chromium print = Save as PDF, local stack, real 14 articles): en 63 pages, ar 56 pages, no blank pages, no failed requests, no images in the articles yet (so none clipped). First run: en contents 4 entries one page early (Boards/Reports/Schedules/SQL) and the ar cover watermark ran off the edge; fixed in cce056b0 (block-by-block paginator; a heading drags a table's header + first row). Re-run: contents match every article's first page in both languages (en 3,6,10,16,22,28,33,37,42,46,50,54,58,63; ar 3,6,10,15,21,26,31,34,38,42,46,49,52,56); watermark inside the cover. PDFs: `C:\Work\DMSCO\help-pdf-4182\analytics-guide.{en,ar}.pdf`. Still owed: the owner reading both PDFs (BO 4187).
