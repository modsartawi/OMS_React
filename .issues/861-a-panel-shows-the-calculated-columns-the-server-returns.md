---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\3519-analytics-calculations-shares-ratios-running-share-and-change-computed-by-the-server-spec.md
blocked-by: BackOffice 3520
---

# 861 — A panel shows the calculated columns the server returns

## What to build

BackOffice spec 3519 adds `calculations` to the analytics query. These are a share of total, a ratio, a running
share and a change from the previous period, computed by SIS.Api and returned as measure columns. Today the web
**drops them silently**:

- the panels build their measure columns from `query.measures` (for example `boards/panel-table.ts`, `measureKeys`);
- each measure's label is read through `viewMeasureOf(k, model, …)`;
- a calculated key is in neither of those.

So a view, board or report saved with calculations, including one the copilot saves (BackOffice 3524/3525), shows no
share column, no share series and no export column.

This ticket makes the web show what the server sends:

- **Calculated columns** are measures wherever measures are read: table columns, chart series (bar, line, combo),
  CSV and Excel export, and series views. They come from `result.columns` entries with `calculation` set, after the
  query's own measures, in the order of `query.calculations`.
- **Format:** `shape: "rate"`, `unit: "percent"`. A `null` value is shown as unknown (blank / "—"), never 0.
- **Label:** the calculation's `label` in the viewer's language. When there is none, the derived default:
  - "Share of {measure}" / "حصة {measure}";
  - "{measure} as % of {of}" / "{measure} كنسبة من {of}";
  - "Running share of {measure}" / "الحصة التراكمية لـ{measure}";
  - "Change in {measure}" / "التغير في {measure}".
  `{measure}` and `{of}` are the model's labels for those measures.
- **The 80 % note:** when the result has `untilReached: false`, the panel shows "The list was cut before {until} %;
  raise the limit or add a filter." in both languages.
- **Live report figures:** `{{fig:<panel>:<key>}}` and `{{fig:<panel>:<key>:<series>}}` resolve a calculated key
  (`boards/live-figures.ts`), formatted as a percent.
- An existing definition without `calculations` renders exactly as today.

Wire: spec 3519 decisions 1–3 and 7 (`AnalyticsSemanticQuery.calculations`, `AnalyticsColumn.calculation`,
`untilReached`). BackOffice owns that shape; if this ticket needs it changed, record it in a BackOffice ticket's
Comments.

## Spine reach

UI (panel table, chart series, export, live figures) → SIS.Api analytics query door

## Proof (→ `tdd` red-green cycles)

- [ ] `panel-table`: a result with a `shareOfTotal` column renders it after the measures, labelled and as a percent,
      with `null` as unknown
- [ ] Chart series: a combo of an additive bar and a share line draws both
- [ ] CSV and Excel export include the calculated column with its label
- [ ] Labels: the default per kind in EN and AR, and an explicit `label` wins
- [ ] `untilReached: false` shows the note; `true` or absent shows none
- [ ] Live figures: `{{fig:p:deliveryShare}}` resolves and formats as a percent
- [ ] A definition without `calculations` renders byte-identically (the existing panel tests stay green)
- [ ] typecheck + lint + build clean
- [ ] **HITL:** on staging, ask the copilot for the 80 % delivery regions, save them as a view, and see the running
      share column and the note on the saved view

## Boundaries

oms-react only, reading spec 3519's wire. It does not touch the query builder (that is 862). It should ship
**before** BackOffice 3525's prompt change goes live, so that a view the copilot saves never loses its share column.

## Done when

A view, board panel or report panel whose result carries calculated columns shows them labelled, in percent, in the
table, chart, exports and live figures, and the staging walk is recorded in Comments.

## Blocked by

- BackOffice [3520](C:/Work/DMSCO/BackOffice/.issues/3520-a-querys-share-of-total-is-each-rows-share-of-the-whole-result-not-of-the-top-n.md)
  (it can be built against a stub of the wire first)
