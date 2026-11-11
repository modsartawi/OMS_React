---
status: open
spec: BackOffice C:\Work\DMSCO\BackOffice\.issues\3630-the-map-chart-stores-as-points-on-a-map-spec.md
blocked-by: BackOffice 3639, 880
---

# 881 — Map points are sized and coloured from the server's legend, nearby stores join into one point, and a point shows its card

## What to build

BackOffice spec 3630, M15 to M20 and M23; ticket BackOffice 3639. This is what makes the map readable.

- **Size** shows the first measure, by area, between the smallest and the largest value the legend carries. A row
  the server marks "smallest, hollow" (zero, negative or empty) is the smallest point, drawn hollow.
- **Colour** shows the second measure, by the step the server put on each row. The panel compares no value with
  an edge.
  - A change has three colours: better, about the same, worse.
  - Any other measure has five steps of one colour.
  - With one measure, every point has one colour.
- **Better and worse differ in lightness as well as hue,** and pass the app's contrast and palette checks.
- **The legend** names both measures with the server's labels, in the screen's language, shows the size scale, and
  names each colour step in words.
- **Grouping.** Stores close together on screen join into one point until the reader zooms in. A group shows its
  number of stores. A click on a group zooms in to open it.
- **A group's sum.** A group also shows the sum of the size measure, only when the legend says the size adds up.
  When it does not (a rate), the group shows the count only. A group always has one neutral colour. This is the
  one place the panel adds figures.
- **The card.** Pointing at a store shows its name, its city and both figures, formatted exactly as the table
  formats them. A click or a tap pins the card; a second tap elsewhere closes it.
- **Figures are in Latin digits** in both languages, like every other chart.

## Proof (→ `tdd` red-green cycles)

The engine is a stand-in; the tests read what the panel would draw.

- [ ] Each point's area follows its value between the legend's smallest and largest · oms-react tests
- [ ] A row marked hollow is the smallest point, hollow · oms-react tests
- [ ] Each point takes the colour of the step on its row; with one measure all points share one colour · oms-react tests
- [ ] The legend shows both labels in the screen's language, the size scale, and each step's words · oms-react tests
- [ ] A group shows its count, and the sum only when the legend says the size adds up · oms-react tests
- [ ] A group's sum equals the sum of its rows as the server sent them · oms-react tests
- [ ] A group has the neutral colour whatever its members' steps · oms-react tests
- [ ] The card shows name, city and both figures in the table's format, and a tap pins it · oms-react tests
- [ ] The colours pass `check-contrast` and `check-palette` · `lint`
- [ ] Riyadh's stores are seen as groups that open on zoom, on the local stack · seen by a person, screenshot

## Boundaries

Behind the server's `Analytics:MapChart`. The panel computes nothing but a group's sum. No drill and no linked
filter from a point or a group.

## Done when

Proof boxes ticked; `test`, `lint` and `build` are green.

## Blocked by

BackOffice 3639, 880.
