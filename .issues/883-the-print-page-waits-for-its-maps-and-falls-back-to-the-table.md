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

- [ ] With two map blocks, the ready marker is set only after both signal "drawn" · oms-react tests (the print page)
- [ ] A map that signals "cannot draw" is replaced by its table and the line, and the page becomes ready · oms-react tests
- [ ] A map that has not signalled after 20 seconds is replaced the same way · oms-react tests, with a fake clock
- [ ] A report with no map sets the marker when it does today · oms-react tests
- [ ] The proof page is gone from the routes · oms-react tests
- [ ] A report with a map block prints to PDF on the local stack, with the map drawn · seen by a person, PDF under `.issues/assets/`

## Boundaries

Behind the server's `Analytics:MapChart`. The 20 seconds sit inside the report worker's 60-second budget for the
whole render. The email's body does not change (M39): the map is in the PDF only. The run on the render host is
BackOffice 3643.

## Done when

Proof boxes ticked; `test`, `lint` and `build` are green.

## Blocked by

880.
