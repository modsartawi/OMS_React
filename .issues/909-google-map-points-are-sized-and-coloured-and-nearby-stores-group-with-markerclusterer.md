---
status: open
spec: BackOffice C:\Work\DMSCO\BackOffice\.issues\3630-the-map-chart-stores-as-points-on-a-map-spec.md
blocked-by: 908
---

# 909 — On Google's map, points are sized and coloured from the legend, nearby stores group with `@googlemaps/markerclusterer` under our count, sum and neutral rules, and a point shows its card

## What to build

BackOffice spec 3630 M15 to M20 and M23, unchanged by the 2026-11-17 move to Google (BackOffice ADR 0139); this
ticket redraws on the Google engine of 908 what 881 drew on MapLibre. The owner saw groups overlap in the MapLibre
walk; grouping over Google's map must not.

- **Points as 881 drew them.** Each store a circle sized by area from its share of the legend's range
  (`pointRadius`), filled with its colour step's token, a hollow point at the smallest size with its colour as the
  ring, `--map-ring` around a filled one. Drawn as Google markers (908's open question decides the marker kind).
  The pure rules of `map-drawing.ts` stay the rules; nothing of the legend or of `map-chart.ts` changes.
- **Groups with `@googlemaps/markerclusterer`** (exact version), its algorithm chosen and tuned so that **no two
  groups and no group and point overlap on screen** at any zoom: the cluster radius is at least the widest group
  circle (`groupRadius`) plus the widest point. Our renderer draws each group as today: one neutral colour
  (`--map-group`), its words the count, and the sum only when the legend says the size adds up (`groupSum`,
  `formatSum`). The panel adds only there (M20).
- **A click on a group** zooms in until it opens (markerclusterer's own click, or `openingZoom` where it differs).
  Nothing joins from zoom 18, as today.
- **The card** as 881 and the review left it: pointing shows the store's name, city and both figures, pointing away
  hides, a tap pins, a tap elsewhere closes, a tap on another store pins that one, the card follows its store and
  stays in the box (`cardAfter`). A group has no card.
- **The proof drives redrawn on Google:** the Riyadh groups that open on zoom, in both languages.

## Proof (→ `tdd` red-green cycles)

Seam 6 of the spec, with the engine (and the clusterer) replaced by stand-ins; prior art is 881's tests, which stay
green where their rule is unchanged.

- [ ] Each point reaches the engine at its radius, colour and hollow state from `map-drawing.ts` · oms-react tests
- [ ] The group renderer: count always, the sum only for an additive size, one neutral colour whatever its members' colours · oms-react tests
- [ ] The clusterer's radius is never smaller than the widest group plus the widest point, so groups cannot overlap · oms-react tests
- [ ] A click on a group eases to the zoom where it opens · oms-react tests
- [ ] The card rules of 881 hold through the Google adapter's pointer and tap events · oms-react tests
- [ ] Mutation check: colour a group by its first member once, and watch the neutral-colour test fail
- [ ] Riyadh's stores as groups that open on zoom, no overlap, the card, in English and Arabic, on the local stack with a real map answer · seen by a person, screenshots under `.issues/assets/`

## Boundaries

The legend, the steps and the row's colour step are the server's (BackOffice 3639); the panel compares no value with
an edge, as today. No new figure is computed beyond the group sum of M20. Behind `Analytics:MapChart`.

## Done when

Proof boxes ticked; `test`, `lint` and `build` are green (the known pre-existing `check-boundaries` findings aside).

## Blocked by

908.

## Open questions

- **markerclusterer's algorithm.** Default: its SuperCluster algorithm with the radius rule above and `maxZoom` 17.
  If its groups do not match 881's look (a group's circle sized from its label), say so here before tuning further.
- **`featuresAt`'s greedy grouping** of 881 is no longer how groups are made. Default: it goes with 911, with the
  MapLibre adapter that called it; `groupSum`, `groupRadius`, `pointRadius`, `openingZoom` and `cardAfter` stay.
