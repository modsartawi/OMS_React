---
status: open
spec: BackOffice C:\Work\DMSCO\BackOffice\.issues\3630-the-map-chart-stores-as-points-on-a-map-spec.md
blocked-by: BackOffice 3641, 880
---

# 884 — The copilot panel draws a map above its table

## What to build

BackOffice spec 3630, M42; ticket BackOffice 3641. A reader asks "show me sales by store on a map", and the panel
draws one, with or without the author grant.

- **An answer that carries a map part** is drawn as a map, through the panel of 879, above the table of the same
  rows. The table is always there, so the copilot's words can be checked against the rows.
- **The map is the one a board draws:** the legend, the groups, the card, the "stores not on the map" line and
  "Show as table" as they stand when this is built (881, 882).
- **It fits the panel's width,** and the reader can open it larger.
- **An answer with no map part** is drawn exactly as today, and loads no map code.
- **When the map cannot be drawn,** the table alone is shown, with the line "The map could not be drawn".

## Proof (→ `tdd` red-green cycles)

- [ ] An answer with a map part draws the map panel above its table, with the result's points and legend · oms-react tests (the panel's answer tests)
- [ ] An answer without one renders as today · oms-react tests
- [ ] The answer's contract type gains the map part first, and an answer from a server without it still parses · oms-react tests
- [ ] When the map cannot draw, the table and the line are shown · oms-react tests
- [ ] A reader with the view grant only sees the map on the local stack, in English and in Arabic · seen by a person, screenshot

## Boundaries

Switched by the server (`Copilot:Charts:Map`, which needs `Analytics:MapChart`): with either off, no answer
carries a map part and the panel behaves as today. The panel computes no figure.

## Done when

Proof boxes ticked; `test`, `lint` and `build` are green.

## Blocked by

BackOffice 3641, 880.
