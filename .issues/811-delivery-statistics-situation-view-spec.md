---
type: spec
status: ready
---

# Delivery statistics as the situation view: courier scope, slot keeping, trips, and charts that read

Grilled 2026-11-06 (`/grill-with-docs`). Web half of a BackOffice brief that is **not filed yet**
(the five asks under "The door's additions" below are its content). Builds on spec/brief 2641
(tickets 484–488) and brief 2660 (489–492). Glossary terms used here, all in `CONTEXT.md`:
**Courier**, **In slot / Out of slot / No slot**, **Avg delivery time**, **Delivered per trip**.

## Problem Statement

An operations lead opening Delivery statistics sees walls of plain number tiles, a hand-drawn chart
with no tooltips or legend, and a table, and cannot tell at a glance whether today is going well.
The questions they actually ask cannot be answered at all:

- "How are **our** deliveries doing — the ones dispatched to FarEye — not the aggregators'?"
- "How many were delivered **inside the slot** the customer was promised, and how many were late?"
- "How many **trips** did the stores make for what they delivered — are drivers batched?"
- "Is today normal?" — no figure is compared with anything.

And one figure misleads: the average hand-over time runs from the delivery's **entry**, so an order
placed at 09:00 for the 18:00–21:00 slot and delivered at 18:40 reads as 580 minutes, when the store
kept its promise.

The analytics charts built in spec 766 look good and read well, but analytics is HQ's trend tool on a
warehouse refreshed on its own schedule; it is not the live, per-store, till-parity view the floor
watches.

## Solution

Delivery statistics stays the **operational first view** — the same door, the till's counting rules,
the 5-minute Today refresh, and the page still derives no figure — and is reshaped as a
**situation view** on the shared `core/charts` kit:

- A **Courier** scope beside Period and Store. All couriers is the till's view and the default;
  choosing one (e.g. FarEye) narrows every figure to the home deliveries actually dispatched to it.
- A **headline strip** of six KPI tiles: Came in, Handed over, In slot, Out of slot, Delivered per
  trip, Avg delivery time — each with its change against a like-for-like previous period.
- The **Delivery and Pick-up funnels** side by side, the Delivery funnel carrying its slot split.
- The misses band, a proper **chart** of Came in vs Handed over, and a **store table** whose Delivery
  view adds the slot, trip and delivery-time columns with in-cell bars and a worst-first sort.
- **Avg delivery time** replaces the entry-based average on the web: the clock starts when the
  delivery became due.

All new figures are the server's. Analytics remains the place for "something else".

## User Stories

1. As an operations lead, I want a Courier picker beside the period and store, so that I can see the figures for one courier's deliveries.
2. As an operations lead, I want the Courier picker to default to all couriers, so that the page matches the till until I choose otherwise.
3. As an operations lead, I want to choose FarEye and see only the home deliveries dispatched to FarEye, so that I can judge our own fleet apart from the aggregators.
4. As an operations lead, I want a pick-up never to count under a chosen courier, so that a courier's figures are not inflated by deliveries it never touched.
5. As an operations lead, I want a delivery to count under a courier only when it was actually dispatched there, so that the courier field's FarEye default does not put undispatched deliveries in FarEye's figures.
6. As an operations lead, I want the Pick-up funnel and the Pick-up misses row hidden when a courier is chosen, so that the page shows nothing that cannot belong to that courier.
7. As an operations lead, I want a caption saying the figures are that courier's home deliveries only, so that I never mistake a courier view for the whole store.
8. As an operations lead, I want the chosen courier kept in the URL, so that a reload, a shared link or a tab switch keeps my scope.
9. As an operations lead, I want the courier, store, leave-outs and period to combine, so that I can ask "FarEye at store P239 over the last 7 days".
10. As an operations lead, I want a headline strip of six figures at the top, so that I can read the situation before scrolling.
11. As an operations lead, I want In slot as a share of Delivered with its count under it, so that I read "are we at 90%?" and how many that is.
12. As an operations lead, I want Out of slot as a share with its count, so that I see how often the promise was missed.
13. As an operations lead, I want No slot shown on the Delivery funnel, so that express and slotless deliveries are visible rather than silently left out of the shares.
14. As an operations lead, I want a delivery handed over before its slot opened to count as in slot, so that an early arrival is not called a miss.
15. As an operations lead, I want slot keeping judged against the slot the delivery held when it was delivered, so that a reschedule (already its own miss) is not counted twice.
16. As an operations lead, I want Delivered per trip, so that I can see how well stores batch their drivers.
17. As an operations lead, I want Delivered per trip to read "—" when there were no trips, so that I never see 0 or infinity for a quiet store.
18. As an operations lead, I want Avg delivery time measured from when the delivery became due, so that a scheduled evening delivery is not charged for the hours before its slot.
19. As an operations lead, I want a delivery with no slot to be timed from its entry, so that express deliveries are timed from the moment they were asked for.
20. As an operations lead, I want a delivery handed over before its slot opened to count 0 minutes, so that the average is never pulled down by negative times.
21. As an operations lead, I want the Pick-up average to stay entry to Made ready, so that a pick-up, which has no slot, keeps its meaning.
22. As an operations lead, I want each headline figure compared with a previous period, so that I know whether today's number is normal.
23. As an operations lead, I want Today compared with the same weekday last week up to the same time, so that a morning in progress is not measured against a whole day.
24. As an operations lead, I want Yesterday compared with the same weekday a week before, so that a Friday is compared with a Friday.
25. As an operations lead, I want a Range compared with the range of the same length just before it, so that "last 7 days" reads against the 7 days before.
26. As an operations lead, I want the compared period named on the strip, so that I know what "▲ 4%" is measured against.
27. As an operations lead, I want the change drawn in ink with an arrow and words, not red or green, so that a rise is not implied good or bad for a figure where up is worse.
28. As an operations lead, I want a tile with no previous figure to show no change line, so that a missing comparison is not drawn as "no change".
29. As an operations lead, I want the Delivery funnel's stages drawn as bars in proportion to Came in, so that the drop-off between stages is visible at a glance.
30. As an operations lead, I want the Delivery funnel's slot split drawn as one bar of In slot, Out of slot and No slot, so that the share of late deliveries is a shape, not a sum to do.
31. As an operations lead, I want the Delivery and Pick-up funnels side by side on a wide screen, so that I compare the two tracks without scrolling.
32. As an operations lead, I want the funnels stacked on a narrow screen, so that the page still reads on a laptop.
33. As an operations lead, I want the Came in vs Handed over chart to show a tooltip on each bar, so that I can read an hour's exact figures.
34. As an operations lead, I want the chart to keep showing while Today refreshes, dimmed with an "Updating" mark, so that the page never blanks every 5 minutes.
35. As an operations lead, I want the chart by the hour for Today and Yesterday and by the day for a Range, as today, so that the shape I know is kept.
36. As an operations lead, I want the store table's Delivery view to carry In slot %, Out of slot %, No slot, Delivered per trip and Avg delivery time, so that I can find the store behind a bad figure.
37. As an operations lead, I want Out of slot %, Delivered per trip and Avg delivery time drawn as bars inside their cells, so that the outlier stores stand out without sorting.
38. As an operations lead, I want the cell bars in ink, never red or green, so that low Delivered per trip (poor batching) and high Out of slot (bad) are not given contradictory colours.
39. As an operations lead, I want the table to open on the Delivery view sorted by Out of slot % worst first when I choose a courier, so that the problem stores are at the top.
40. As an operations lead, I want the table to keep its current default view and sort with all couriers, so that the till-parity view is unchanged.
41. As an operations lead, I want the Pick-up view hidden in the table when a courier is chosen, so that it never offers figures that cannot exist.
42. As an operations lead, I want every figure the server leaves out to read "—", so that an older server never shows a fake 0.
43. As an operations lead, I want a share with nothing delivered to read "—", so that 0 of 0 is not read as 0%.
44. As an operations lead, I want the new figures to read correctly under Arabic, so that shares, counts, ranges and the compared period never reverse.
45. As an operations lead, I want an unknown or refused courier to show the server's own refusal, so that a bad link explains itself.
46. As an operations lead, I want the Unspecified tile kept when there are deliveries of neither track, so that bad data stays visible.
47. As an operations lead, I want Handed over's Delivered | Picked up split kept under its headline tile, so that the till's split is still on screen.
48. As a store-network manager, I want the page to show exactly the server's figures, so that the web and the till never disagree on a number they both show.
49. As a till user, I want my POS Statistics to keep working unchanged, so that a web change never forces a till release.
50. As a developer, I want the page's charts to come from `core/charts`, so that the app keeps one chart kit with one set of RTL, contrast and accessibility rules.
51. As a developer, I want the hand-drawn chart retired, so that there is no second chart implementation to maintain.

## Implementation Decisions

### Where things live

- The work stays in the existing **`oms/delivery-statistics`** feature and its `delivery-statistics`
  i18n namespace. No new route, menu item or namespace.
- Charts come from **`core/charts`** only (`KpiTile`, `SeriesChart`, `CellBar`, `ChartFrame`); it
  already takes plain props and never depends on a feature. Anything from `features/analytics` this
  page wants (a view-mapping helper) graduates **up to `core`**, it is never imported sideways.
- The wire model in `core/models` gains the new optional fields; the feature's `api.ts` passes them
  through as sent, as today.
- If the funnel stage bar or the slot split bar is not one of `core/charts`' forms, it is built as a
  small `core/charts` form (plain props, `dir="ltr"` box mirrored through props, ink and slot tokens),
  not hand-drawn inside the feature.

### The rule that still holds

The page shows what the door sends and derives **no figure**: no share, no ratio, no change, no
average, no total. The only arithmetic on the page is **geometry** — a bar's length as a proportion
of a reference the server sent (a stage over Came in, a cell over its column's largest value),
exactly as the existing chart and `CellBar` already do. A figure the server leaves out reads "—",
never 0, and draws no bar.

### The door's additions (the BackOffice brief's content — ⚠ a web proposal, BackOffice confirms)

All on `GET SdDocumentWeb/StoreStatistics`, all **optional** in the model so an older server reads "—":

1. **`Courier` query parameter** — one courier type code (`FREY`, `OTOX`, `SMSA`, `SLNK`; the retired `DAWA` is still a valid code);
   absent = every courier. When present the server counts **only home deliveries actually dispatched
   to that courier, by the dispatch it sent** — never by the delivery's courier field alone, which
   defaults to `FREY` even on a pick-up (BackOffice `CompetedDeliveryNoCourierTests` names the trap).
   It scopes every figure: totals, `tracks`, `series`, `stores`, and the previous block. An unknown
   code is refused as the existing invalid-query `SDD-02132`.
2. **Slot keeping**, on the Delivery track of the totals and of each store row: `inSlot`,
   `outOfSlot`, `noSlot` (counts of Delivered) and `inSlotShare`, `outOfSlotShare` (0–1, out of
   Delivered; absent when nothing was delivered). Judged against the slot the delivery held **when it
   was delivered**, by its Delivered time; before the slot's end is in slot, so early is in slot.
3. **`deliveredPerTrip`**, on the Delivery track of the totals and of each store row; absent when
   there were no trips.
4. **`avgDeliveryMinutes`**, a **new field** beside the unchanged `avgHandOverMinutes` (which the till
   keeps reading): on the Delivery track, from due (the later of entry and the held slot's start; entry
   when there is no slot) to Delivered, an early delivery counting 0; on the Pick-up track, entry to
   Made ready as today; store-wide, both tracks together, each from its own start. Totals and store
   rows. `null` when there is nothing to average.
5. **A previous block** for the six headline figures, and the compared window:
   - Today → the same weekday last week, from its start up to the same time of day as `asOf`;
   - Yesterday → the same weekday a week before;
   - Range → the range of equal length ending the day before `From`.

   Each figure carries `{ value, change, changePct }` — the server's own subtraction and percentage;
   `changePct` absent when the previous value is 0. The page picks the arrow from the sign of
   `change` and does no arithmetic.

Proposed shape (prose decisions above are authoritative):

```ts
type StoreStatisticsQuery = { /* … existing … */ Courier?: string }

interface SlotKeeping { inSlot?: number; outOfSlot?: number; noSlot?: number; inSlotShare?: number; outOfSlotShare?: number }

// added to the Delivery track (totals and each store row)
interface DeliveryTrackAdditions { slot?: SlotKeeping; deliveredPerTrip?: number | null; avgDeliveryMinutes?: number | null }
// added to the Pick-up track and the store-wide figures (totals and each store row)
// avgDeliveryMinutes?: number | null

interface PreviousFigure { value?: number | null; change?: number | null; changePct?: number | null }
interface StatisticsPrevious {
  from: string; to: string; until?: string   // the compared window; `until` = Today's cut-off time
  cameIn?: PreviousFigure; handedOver?: PreviousFigure
  inSlotShare?: PreviousFigure; outOfSlotShare?: PreviousFigure
  deliveredPerTrip?: PreviousFigure; avgDeliveryMinutes?: PreviousFigure
}
// DeliveryStatistics gains: previous?: StatisticsPrevious
```

### The page, top to bottom

- **Control bar**: the period tabs and range picks as today; then Store, the leave-outs, and the new
  **Courier** picker (all couriers + the four live types — FarEye, OTO, SMSA, Starlinks; captions from the namespace, codes are machine
  values). The courier is in the URL query beside the others.
- **Courier caption** when a courier is chosen: the figures are that courier's home deliveries only.
- **Headline strip**: six `KpiTile`s — Came in; Handed over (with the Delivered | Picked up split
  under it); In slot (share, with "n of N delivered" under it); Out of slot (likewise); Delivered per
  trip; Avg delivery time (minutes). Each shows its server change against the named compared window,
  in ink; with no previous figure, no change line. The Unspecified tile stays, shown only above zero.
  The old store-wide "Avg hand-over" tile leaves the web.
- **Funnels**: the Delivery funnel (Came in → Made ready → Out for delivery with Trips → Delivered,
  then the slot split bar In slot | Out of slot | No slot) and the Pick-up funnel (Came in → Made ready
  → Picked up), side by side from a wide breakpoint, stacked below it. Stage bars are proportional to
  the lane's Came in; every figure stays readable as text, isolated. The lane's own average is its Avg
  delivery time. Under a chosen courier the Pick-up funnel is not drawn.
- **Misses band**: as today, one row per track; the Pick-up row is not drawn under a courier.
- **Chart**: `SeriesChart`, bar form, grouped, two series (Came in, Handed over) on one axis, rows in
  the server's order, labels by the hour or the day as today (read as text, never through `Date`),
  inside `ChartFrame`. The query keeps the previous answer while refreshing so the frame dims rather
  than blanks. The hand-drawn chart and its model are deleted.
- **Store table**: the Delivery view gains In slot %, Out of slot %, No slot, Delivered per trip and
  Avg delivery time; Out of slot %, Delivered per trip and Avg delivery time render through `CellBar`
  (magnitude in ink). Under a chosen courier: opens on the Delivery view, sorted by Out of slot %
  descending with "—" last, and the Pick-up view chip is hidden. With all couriers: today's default
  view and sort.

### Envelope

Through `@/core/api` as today. Business refusals shown in the server's words: `SDD-02131` (range
over 31 days), `SDD-02132` (invalid query, now including an unknown courier). No new codes.

### i18n and bidi

New keys in `delivery-statistics` only: the Courier picker and its four captions, the courier
caption, the six headline captions, the slot split captions, the new table headers, the compared
window sentence ("vs {{range}}" / "vs {{day}} to {{time}}" — each value isolated, a range built with
`formatRange` and isolated whole). Shares, counts, minutes and ratios are machine values (`Ltr`);
`fsi` never in a grid cell.

## Testing Decisions

- A good test pins **what the reader sees from what the door sent**: given a wire answer, which
  figures, which "—", which tiles and bars, which default sort. It never asserts how a component is
  built.
- **Pure tier (vitest, in memory)** — the page's existing seam, extended:
  - the query: Courier read from and written to the URL, sent to the door, absent = all couriers;
  - a headline model: the six tiles and their change from the wire, "—" for any absent figure or
    absent previous, the arrow from the sign of the server's change;
  - the slot model: the Delivery track's slot keeping, shares, Delivered per trip and Avg delivery
    time read as sent; what is hidden under a chosen courier;
  - the store rows: the five new Delivery-view columns, the cell-bar maxima, the courier default
    (Delivery view, Out of slot % descending, "—" last);
  - a series mapper to `core/charts` rows, in the server's order, nothing filled in — replacing the
    hand-drawn chart's model and its test.
  Prior art: `lanes.test.ts`, `misses-rows.test.ts`, `store-rows.test.ts`, `query.test.ts`,
  `chart-model.test.ts` in the same feature.
- **Flow tier (Playwright)** — extend `tools/delivery-statistics-drive.mjs` against its stub door:
  the Courier picker sends `Courier`; the courier caption shows and the Pick-up funnel, misses row and
  table view hide; the headline strip's figures and change lines; "—" from a fixture that drops every
  new field (an older server); the table's courier default sort and its cell bars; the chart's dimmed
  frame during the Today refresh; LTR and RTL; no page errors.
- No RTL (React Testing Library) seam: still not installed (spec 083's ruling).
- A **live walk** waits on the BackOffice brief built and deployed, against staging; till parity is
  checked on the figures the till also shows (Came in, Handed over, the stages, the misses).

## Out of Scope

- **Drill-through** from a figure to the deliveries behind it (needs a list door with slot-kept and
  courier criteria) — a follow-up.
- An **In slot / Out of slot split per chart bucket** ("when in the day do we go late") — a follow-up.
- An **"Open in Analytics"** link with this page's period and store — waits on analytics v1 live (784).
- The **till's own switch** to Avg delivery time and its caption — a till-side ticket later.
- Any red/green status colouring of figures, an "Early" slot bucket, an SLA target.
- Moving delivery statistics into analytics, or analytics' figures into this page.

## Further Notes

- **`DAWA` is retired** (owner, 2026-11-06): the old last mile, out of use for about two years
  (briefly an emergency fallback, now dead). The picker does not offer it; the server still accepts
  the code, so an old link reads the server's figures (zeros) rather than a refusal.
- The BackOffice brief carrying the five asks is **filed as BackOffice spec 3404** (draft, 2026-11-06,
  `C:\Work\DMSCO\BackOffice\.issues\3404-the-web-statistics-door-scopes-by-courier-and-carries-slot-keeping-trips-delivery-time-and-the-previous-period-spec.md`). It flags that a courier scope likely needs a courier key on
  `SdStoreDayStat` plus a 31-day re-summary. Tickets build against the stub until it is built and
  deployed (every new field is optional).
- Watch the old-build writer that broke 488's parity (BackOffice 2644): a server without these fields
  must read "—" everywhere, which the optional model guarantees.
- Analytics' light `--chart-2` gold contrast (2.83:1) is a known open item from spec 766; the
  grouped chart's second series inherits it.
