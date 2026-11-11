---
status: open
spec: BackOffice C:\Work\DMSCO\BackOffice\.issues\3630-the-map-chart-stores-as-points-on-a-map-spec.md
blocked-by: BackOffice 3635, BackOffice 3638, 879
---

# 880 — The designer offers Map when the query fits and says why when it does not; a board panel and a report block draw it

## What to build

BackOffice spec 3630, M13, M22, M25 and M26; ticket BackOffice 3638. An author builds a map like any other chart.

- **The analytics contract changes first:** the chart type `map`, the extra columns a map result carries (the
  coordinates, the store's name and city), and the list of chart types the door accepts.
- **The designer offers "Map"** in its chart choices, only when the server says it accepts `map`.
- **Offered when the query fits:** one dimension, which is the store; no date; one or two measures; no named
  series. Otherwise it is listed as unavailable with the reason, in both languages. The server stays the
  authority and refuses the rest.
- **The author chooses which measure is the size and which is the colour.** The first measure is the size; a
  control swaps the two.
- **A saved view, a board panel and a report block draw the map** through the panel of 879, with the result's
  points. Points are plain until 881.
- **Filters, the period and the board's filters** act on a map as on any chart.
- **A map tile on a board has a minimum size.** Default: half the board's width, and tall enough for the legend
  and the map together. The grid does not let it shrink below that.
- **A map emits no cross-filter and has no drill** (M23).

## Proof (→ `tdd` red-green cycles)

- [ ] "Map" is offered for one store dimension with one or two measures, and only when the server accepts `map` · oms-react tests (the shape rules)
- [ ] By city, with a date, with three measures or with named series it is unavailable, each with its reason in both languages · oms-react tests (the shape rules)
- [ ] Swapping the two measures swaps size and colour in the saved definition · oms-react tests (the editor)
- [ ] A view of type `map` hands the map panel one point per row that has coordinates · oms-react tests
- [ ] A board panel and a report block of type `map` draw the map panel, and a board without one loads no map code · oms-react tests
- [ ] A map tile cannot be sized below its minimum · oms-react tests (the board grid)
- [ ] A view saved as a map opens in the designer as a map · oms-react tests

## Boundaries

Behind the server's `Analytics:MapChart`: with it off the server does not list `map`, and the designer, the
boards and the reports behave as today. The web's copy of the shape rule only chooses what to offer.

## Done when

Proof boxes ticked; `test`, `lint` and `build` are green.

## Blocked by

BackOffice 3635 (the local PDF proof: nothing after 879 is built until it passes), BackOffice 3638, 879.
