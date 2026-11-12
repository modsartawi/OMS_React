---
status: done
spec: BackOffice C:\Work\DMSCO\BackOffice\.issues\3587-the-copilots-analysis-tools-what-changed-against-the-others-and-the-headline-spec.md
blocked-by: BackOffice 3604, BackOffice 3606, 876
---

# 877 — A table and a chart draw last year beside the current period, and say when last year is not held

## What to build

BackOffice spec 3587, B9, B11 and B12; tickets 3604 and 3606.

- A result that carries last year's rows is drawn with them wherever the previous period's rows are drawn today
  (the table and the bar chart): last year's figure beside the current one, with last year's dates in the legend
  or the column heading.
- With both comparisons on, both are drawn and told apart by their labels.
- When the result says last year is **not held** for an area, the panel shows no last-year figure for it and a
  short note with the day the data starts. It is never drawn as zero.
- A result without last year is drawn exactly as today. Exports (CSV, xlsx) carry last year's columns when the
  table shows them.

## Proof (→ `tdd` red-green cycles)

- [x] A table with last year's rows shows a last-year column, matched to the current rows as the previous period's are · oms-react tests · `draw-last-year.test.ts`: "the table form puts it after the measure, matched by member, headed by last year's dates", "the table view of a panel does the same, and a calculated column gets no last-year column", "a date breakdown pairs each bucket with last year's bucket of the same place"
- [x] A bar chart with last year's rows draws a last-year series, labelled with its dates · oms-react tests · "draws as a series chart, so last year can stand beside it", "adds last year as a grouped series, matched by member, named with last year's dates", "a stacked bar is never stacked onto last year", "a line over time draws last year beside it…"
- [x] With both comparisons, both are drawn and labelled apart · oms-react tests · "a table shows the previous column, then the last-year column, each under its own heading", "a bar draws the measure, the previous period and last year side by side, never stacked", "a line draws both beside it…", the three KPI tests, `series-ink.test.ts`
- [x] A "not held" area shows the note with its first day and no zero · oms-react tests · the eight tests under `a "not held" area shows the note…`
- [x] A result without last year renders as today · oms-react tests · the six tests under `a result without last year renders as today`; no existing test file changed
- [x] The export carries the last-year column · oms-react tests · "the CSV and the xlsx write it after the measure, headed by last year's dates, numbers as numbers", "with both comparisons the file has both columns, and a not-held figure has none"
- [x] The labels and the note have their Arabic wording · oms-react tests · the five tests under `the labels and the note have their Arabic wording`

## Boundaries

Chart types that do not draw the previous period today do not gain last year here.

## Done when

Proof boxes ticked.

## Blocked by

BackOffice 3604, BackOffice 3606, 876

## Build notes (2026-11-11)

Built on branch `impl/3587-877`, commit `9879c70a`, merged into `spec/3587-analysis-tools` (fast-forward). Not
pushed.

**Tests.** `npx vitest run` over the whole repo: 10184 passed before, 10221 after (37 new:
`src/features/analytics/boards/draw-last-year.test.ts` 34, `src/core/charts/series-ink.test.ts` 3). No existing
test file changed. Typecheck clean; the gates' output is unchanged (the boundaries gate was already red). Eight
mutation checks were each caught. **Not seen in a browser:** the screen files (`KpiTile`, `SeriesChart`,
`SeriesPanel`, `LastYearNote`, `ViewChart`, `PanelBody`) are covered by typecheck only. Worth a look: the two
greys side by side on grouped bars, and the legend with the long dated name.

### A correction to this ticket

The ticket's "(the table and the bar chart)" was too narrow: 876 offers the switch on KPI and line too. Built:
last year is drawn on every chart type that draws the previous period today.

### What each chart type does

| Type | Last year alone | With both comparisons |
|---|---|---|
| Table (the table form, a panel's "view as table", CSV, xlsx) | A last-year column after each measure; rows matched by member, date buckets by place; no row last year is an empty cell | The measure, then the previous period, then last year |
| Bars | A last-year series for the first measure, matched by member, always grouped (never stacked), in the darker grey | The measure, the previous period, last year |
| Line (one measure over time) | A last-year series by position, darker grey, short dash | Both drawn; the previous period keeps its longer dash |
| KPI | A line under the headline: "versus X last year (dates)"; no arrow | The arrow and the previous-period line unchanged, plus the last-year line |

- Lines or bars with a breakdown, several measures on a line, and named series draw no previous period today, so
  they draw no last year. Area, donut, heat map and combo are untouched.
- No new colour token was added.
- **Rule added:** last year is drawn only when the result has both its rows and its dates, so it is always named
  with its dates.

### Open: the KPI's last-year figure

The web computes no change against last year. But the last-year figure follows the headline's existing rule: one
row is shown as sent, and several rows of a figure that adds up are summed, as the current and previous figures
are. A rate over several rows shows none. If that sum counts as the web computing a figure, the fix is to state
last year only for a one-row answer. **The owner's call.**

### Not held

`lastYearNotHeld` is typed and read. Those measures get no column, no series and no KPI figure, even if a row
wrongly carried 0. A note sits under the panel, one line per area:

- EN: "Last year is not shown for {{measures}}: the data starts on {{day}}."
- AR: "لا يُعرض العام الماضي لـ {{measures}}: تبدأ البيانات في {{day}}."

### Other new labels

| Key | English | Arabic |
|---|---|---|
| `boards:view.lastYearColumn` | {{measure}} (last year, {{range}}) | {{measure}} (العام الماضي، {{range}}) |
| `boards:view.lastYearSeries` | Last year ({{range}}) | العام الماضي ({{range}}) |
| `common:charts.kpi.lastYear` | versus {{value}} last year ({{range}}) | مقابل {{value}} في العام الماضي ({{range}}) |

### For 878

- `copilotTableResult` already goes through `readResult`: passing `lastYear`, `lastYearPeriod` and
  `lastYearNotHeld` into it is enough for the copilot's table view and download to gain the column.
- `<LastYearNote result model lang />` is the not-held note; it sits beside `TruncatedNote` / `AreaNotes`.
- Helpers in `last-year.ts`: `lastYearOf`, `lastYearRange`, `lastYearMeasures`, `notHeldMeasures`,
  `lastYearMatcher`, `lastYearKey`, `lastYearNotes`. `comparisonMatcher` in `previous-rows.ts` is the shared rule.

### Not done

- `tools/analytics-stubs.mjs` still answers the previous period only.
