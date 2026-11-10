---
status: done
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

- [x] `panel-table`: a result with a `shareOfTotal` column renders it after the measures, labelled and as a percent,
      with `null` as unknown
- [x] Chart series: a combo of an additive bar and a share line draws both
- [x] CSV and Excel export include the calculated column with its label
- [x] Labels: the default per kind in EN and AR, and an explicit `label` wins
- [x] `untilReached: false` shows the note; `true` or absent shows none
- [x] Live figures: `{{fig:p:deliveryShare}}` resolves and formats as a percent
- [x] A definition without `calculations` renders byte-identically (the existing panel tests stay green)
- [x] typecheck + lint + build clean
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

## Comments

**2026-11-10 — built (impl/3519-861).** All proofs are red-green, except the HITL staging walk, which is still
**owed**: it needs BackOffice 3522 (`cumulativeShare` + `untilReached`) and 3525 (the copilot prompt) deployed on
staging. Record it here when it is walked.

- **Wire types live in one file:** `src/core/models/analytics-calculations.ts` (kinds, `AnalyticsCalculation`,
  `AnalyticsColumnCalculation`, limits, tolerant readers). `analytics.ts` only references it, through
  `AnalyticsSemanticQuery.calculations?`, `AnalyticsColumn.calculation?` and `AnalyticsQueryResult.untilReached?`.
  `wire.ts` `readDefinition` / `readResult` read them; absent stays absent.
- **Render:** `boards/calculations.ts`:
  - `measureKeysOf` gives the query's measures, then the calculated columns in `query.calculations` order. It is read
    by `panel-table`, `toTableView`, `toComboView` and `toSeriesView`.
  - `calculatedModel` adds one labelled rate/percent measure per calculated column, so `viewMeasureOf` reads it
    unchanged.
  - `calculationLabel` gives the explicit label, else the per-kind default from `boards:calculation.label.*`.
  - `untilNote` gives the 80 % note, which `UntilNote.tsx` renders in the chart and table views.
  - The components go through `use-calculations.ts`, which is used in `ViewChart`, the `PanelBody` table and the
    `PanelActions` exports.
- **Live figures:** `figuresOf` offers each calculation key after the measures, per series too. The value is
  formatted by the server's Words answer, as for any figure.
- **Format:** the new `MeasureUnit` `'percent'` is percent points (42.5 = 42.5 %). `core/charts/format.ts` scales it
  by 1/100 before `Intl`'s percent style, so it reads like a `share`. A `null` cell is blank.

**Wire assumptions, reconciled against BackOffice 3520 (BackOffice-3519 @ 743caeb81, `AnalyticsWire.cs`,
`AnalyticsCalculations.cs`).** No mismatch was found:
- the fields are camelCase `key/kind/measure/of/until/label`;
- `of` and `until` are nullable (`until` is a decimal, so a JSON number), and so is `label`, which is `{en, ar}`,
  both languages or neither (the server refuses a one-sided label; the web reads one leniently);
- the column is `role "measure"`, `shape "rate"`, `unit "percent"`, `calculation {kind, measure, of}`, and
  `calculation` is null on other columns;
- values are percent points (`part / whole × 100`), rounded to 4 dp, null on a zero or missing denominator.

Still on the spec's shape, because they are not merged yet:
- `untilReached` (3522): a boolean on the result, absent = no note;
- the `ratio`, `cumulativeShare` and `change` kinds (3521–3523);
- calculated figure keys in the Words answer (3524).

Gates:
- `npm run typecheck` is clean and `npm run build` is clean.
- `npm test` passes: 733 files, 10020 tests.
- `npm run lint` fails on **4 pre-existing** import-boundary violations in
  `src/features/insurance-rules/aliases/door-shapes.test.ts`. That file is unchanged since d412363d, and
  `check-boundaries` reports the same 4 on a d412363d checkout. The other four gates (`grid-base`, `contrast`,
  `palette`, `controls`) pass when run directly.
