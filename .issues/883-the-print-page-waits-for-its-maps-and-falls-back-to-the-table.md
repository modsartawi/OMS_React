---
status: open
spec: BackOffice C:\Work\DMSCO\BackOffice\.issues\3630-the-map-chart-stores-as-points-on-a-map-spec.md
blocked-by: 880
---

# 883 — The print page says it is ready only after its maps are drawn, and prints the table when a map is not ready in 20 seconds

## What to build

BackOffice spec 3630, M34, M37 and M38. The scheduled-report PDF is printed from the report's print page. Today
that page says it is ready when no request is in flight. A map draws after its data arrives, so a report with a
map would be printed with an empty map.

- **The print page draws a map block** like any other block.
- **Ready waits for the maps.** The page sets its ready marker only after every map on it has signalled "drawn"
  (879), on top of today's rule.
- **A map that cannot be drawn, or is not drawn within 20 seconds,** is replaced by the table of the same rows
  with the line "The map could not be drawn". The page then becomes ready. The report is still sent.
- **The credit line** is on the printed map.
- **A report with no map** becomes ready exactly as today.
- **The proof page of 879 is removed.** The real print page takes its place in the local PDF proof.

## Proof (→ `tdd` red-green cycles)

- [x] With two map blocks, the ready marker is set only after both signal "drawn" · oms-react tests (the print page)
- [x] A map that signals "cannot draw" is replaced by its table and the line, and the page becomes ready · oms-react tests
- [x] A map that has not signalled after 20 seconds is replaced the same way · oms-react tests, with a fake clock
- [x] A report with no map sets the marker when it does today · oms-react tests
- [x] The proof page is gone from the routes · oms-react tests
- [ ] A report with a map block prints to PDF on the local stack, with the map drawn · seen by a person, PDF under `.issues/assets/`

## Boundaries

Behind the server's `Analytics:MapChart`. The 20 seconds sit inside the report worker's 60-second budget for the
whole render. The email's body does not change (M39): the map is in the PDF only. The run on the render host is
BackOffice 3643.

## Done when

Proof boxes ticked; `test`, `lint` and `build` are green.

## Blocked by

880.

## Comments

- 2026-11-17 (implementation, branch `spec/3630-883` off `spec/3630-map-chart` @ `8d0c0ca1`):
  - **The seam.** `src/features/analytics/boards/print-maps.ts` (pure): each map block on the page joins while mounted
    and ends once, `drawn` or `fell-back` (it said cannot draw, or 20 s passed since it joined); a late `drawn` after a
    fall-back changes nothing, so the table is what prints. `printReady` = today's rule (no request in flight and the
    1.2 s draw moment passed) AND every joined map ended; with no map it is today's rule unchanged.
    `PrintMapsContext` hands it to the map blocks; only the print page provides it, so a view, a board and the runner's
    page draw as before (they gain only the line above the table on cannot-draw).
  - **The page.** `AnalyticsReportPrintPage` holds the 1.2 s timer (and, opened by a person, `window.print()`) until
    the maps have settled too, so the person's own print also waits for the map. The map keeps its default size: the
    page lays the report out at `PAPER_PX` on screen and paper alike, so the canvas is never resized between drawing
    and printing (3635's warning); `preserveDrawingBuffer` is already in the engine.
  - **The line** "The map could not be drawn" / "تعذّر رسم الخريطة" (`boards:view.mapCannotDraw`) above the table form
    of the same answer.
  - **Tests:** `print-maps.test.ts` (two maps, cannot draw, 20 s with fake timers, no map, leave/close),
    `map-chart.test.ts` (a fell-back map block renders the line and the table, not the panel; still-drawing renders
    the panel), `src/app/map-proof-gone.test.ts` (router source has no proof route; page and its drive deleted).
    Mutation-checked: dropping the cannot-draw ending, the timeout, the maps term of `printReady`, or the print-state
    branch in `MapBody` each turns a test red. `npm test` 10,898 green; `typecheck` + `build` green.
  - ⚠ **`npm run lint` is red only on the 4 pre-existing `check-boundaries` findings** in
    `src/features/insurance-rules/aliases/door-shapes.test.ts` (present on `spec/3630-map-chart` before this; 879's notes
    record it). The other five gates, including `check-map-build`, pass.
  - **The local PDF proof now uses the real print page:** `tools/report-map-print-drive.mjs` (replaces
    `tools/map-proof-drive.mjs`) opens `/analytics/print/report/r-883?…&ticket=T-883` with the four ticket doors
    stubbed (a map block over 7 Riyadh stores + a bar block), network off, headless Edge with swiftshader, waits for
    `data-print-ready` like the renderer, and prints A4. 2026-11-17: en drawn (ready at ~14 s cold / ~6 s warm), ar
    drawn, credit on the map, 0 outside requests, 0 console errors; with the base map never answering the block is the
    table under the line and the page is ready at ~22.5 s. PDFs for the person's look:
    [`assets/883-report-map-en.pdf`](assets/883-report-map-en.pdf),
    [`assets/883-report-map-ar.pdf`](assets/883-report-map-ar.pdf),
    [`assets/883-report-map-timeout-en.pdf`](assets/883-report-map-timeout-en.pdf).
    BackOffice `MapPdfProofTests` (3635) still opens `/dev/map-proof`, which is gone: repointing it at the print route
    is BackOffice's (3643's run on the render host prints a real report anyway).
  - Seen while proving, not changed here: under an Arabic ticket the print page leaves `<html dir>` empty, so the
    paper is laid out left to right (the words are Arabic, the map names Arabic). Pre-existing (835's print route).
  - Remaining open box: **a person's look at the PDF**. Status stays `open` until then.
