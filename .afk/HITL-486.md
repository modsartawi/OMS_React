# HITL — ticket 486 (Came in / Handed over chart)

## Q: Two charts (as the till) or one?
**Decision taken:** One chart, Came in and Handed over side by side per bucket, on ONE shared axis whose top is the till's round step (`NiceSteps` 6…300, then whole 300s) over the larger of the two series.
**Why:** the ticket says "side by side for each bucket" and "the max scales both series"; one axis lets the pair be read against each other.
**Revisit if:** the owner wants the till's two separate charts, each on its own axis.

## Q: Which token colours?
**Decision taken:** Came in = `primary`, Handed over = `success` (both already asserted ≥3:1 on `--card` by the contrast gate, both themes). Gridlines `border`, baseline `border-strong`, hovered bucket `muted`.
**Why:** the till uses Primary and Teal; the app's only teal token is `prescription`, which carries a different meaning. Handed over is the "done" figure, so success green fits.
**Revisit if:** the owner wants till-exact teal (it would need a chart token in `global.css`).

## Q: Labels and readout format
**Decision taken:** As on the till: by the hour, every third hour labelled `HH`; by the day, the day of the month, thinned to every 2nd (8–14 days) or 5th (over 14). The readout shows the bucket as `HH:00` (hour) or `yyyy-MM-dd` (day), then the two values. The bucket is read as text (`yyyy-MM-ddTHH:mm`), never through `Date`.
**Why:** till parity; a C# `DateTime` with no zone must not shift through a UTC round trip.
**Revisit if:** the door sends buckets in another format (488) — an unreadable bucket keeps its column, unlabelled, and the readout shows it raw.

## Q: The till's "now" column, future columns and the value written over a column
**Decision taken:** Not built. Every bucket draws the same way. On Today, the future hours draw empty because the server sends 0. The values show in a hover/focus readout instead of over a column.
**Why:** the ticket's settled list asks only for a legend and a hover/focus readout. Telling the future apart would mean reading the client clock against the server's buckets, which is beyond "show what the door sends".
**Revisit if:** the owner wants Today's future hours to look different from hours that really had no activity (the spec reviewer raised this).

## Q: No totals under the chart?
**Decision taken:** None. The till's sub-captions ("N in total") sum the series. The bands already show the door's own Came in and Handed over.
**Why:** the page derives no figure.
**Revisit if:** never, unless the door sends a series total.

## Q: Keyboard access
**Decision taken:** The plot is one tab stop. Once it is focused, the arrow that points along the reading direction steps forward (ArrowLeft under RTL), and Home/End jump to either end. The readout is `aria-live` only while the plot has focus, so a pointer sweep queues no announcements.
**Why:** "hover/focus readout" without 24–31 tab stops; this follows the code-review findings.
**Revisit if:** an accessibility review prefers one focusable element per bucket.

## Noted, not changed (outside this slice; raised by /code-review against 484/487 code)
- `DeliveryStatisticsPage` hides every figure (now the chart too) when a background Today poll fails, because `data` is dropped on `isError`. HITL-484 ruled "no stale figures beside a failed read", so I left it, but on a 5-minute poll one blip blanks the screen until the next poll.
- `useMinuteClock` is now the third copy of the hook (`document/ActivitySpine`, `donor-requests`). It could move up to `@/core/ui`.
- The page's `FLOW`/`MISSES` lists repeat `store-rows.ts`'s `FLOW_FIGURES`/`STORE_FIGURES`.
- `canOpenDeliveryStatistics` reads `canOpenList` directly rather than through `omsGrants`.

## Contract gap
None: the chart reads only `series[].bucket/cameIn/handedOver` as the brief names them. A value missing from a bucket reads the dash and draws no column.
