---
status: done
spec: BackOffice .issues\3632-sql-mode-the-copilot-writes-and-runs-one-guarded-select-and-its-answer-can-be-saved-spec.md
blocked-by: BackOffice 3677
---

# 891 — The "SQL" and "SQL, verified" marks show in the library, on a board panel, in a report block and on the print page, with the "filters do not apply" and "can no longer run" messages

## What to build

BackOffice spec 3632 Q43, Q48, Q49: the marks wherever a SQL item is drawn, including the print page the PDF is made
from; a viewer can open the SQL behind a panel; the "filters do not apply to this SQL panel" line; the plain "can no
longer run" message with its reason in place of the chart.

## Proof (→ `tdd` red-green cycles)

- [x] Library, board panel, report block and print page draw the mark · oms-react tests
- [x] The "can no longer run" read draws the message and no chart · oms-react tests
- [x] A board with filters draws the "filters do not apply" line on the SQL panel · oms-react tests

## Boundaries

Follows the contract written by BackOffice 3677.

## Done when

The Proof boxes are ticked.

## Blocked by

BackOffice 3677

## Build notes

Built 2026-11-12 on `t891` (from `spec/3632`).

- **Contract** (BackOffice 3677's wire) in the model files: a board panel's read-only `engine?: 'sql'`
  (`AnalyticsBoardPanel`), the report's SQL block held by reference `AnalyticsReportSqlBlock { id, kind: 'panel', viewId,
  engine: 'sql' }` (no definition, no title), and a SQL panel's answer `AnalyticsQueryResult.engine` / `.sql`
  (`AnalyticsSqlPanelAnswer` in `core/models/analytics-sql.ts`). A Cube answer carries no `engine`. The readers in
  `wire.ts` keep each; a block with a `viewId` and no definition reads as a SQL block too.
- **Pure** `features/analytics/boards/sql-panel.ts`: `sqlMark` (library row, board panel, report block, answer;
  `sql.verified` wins on an answer), `isSqlBlock`, `sqlPanelView` (a refusal wins over any result: Q49), `sqlPanelInput`
  (`{ itemId, revision, panelId, values: {} }` or `{ draft, panelId, values: {} }`: no values, so moving a filter does
  not ask again), `sqlItemAnswer` (a v1 board with no item to ask by reads the item itself).
- **Drawn:** `SqlMark` (one badge: library rows, deleted rows, `SqlItemView`), `SqlPanel` (board panel via `BoardPanel`,
  report block via `ReportDocument`'s `ReportBlock`, so the runner's page, the designer and the print page alike): the
  title and mark, "Open the SQL" (the item's page; hidden on paper), "Filters do not apply to this SQL panel." when the
  board or report declares any parameter, its rows, or "This SQL panel can no longer run:" with the reason
  (`SqlRefusalNote`) in place of the chart. `SqlResultTable` no longer clips its rows on paper.
- **Report designer:** `reportPanels` / `PanelBlock` are Cube blocks only, so a SQL block is never bound, validated or
  given figures; its inspector says it is held by reference (`designer.sqlBlock`).
- **Tests:** `sql-panel.test.ts` (7, one cycle per Proof box plus the words in both languages). Mutation: a result
  winning over a refusal fails it. `typecheck` and `npm test` green (754 files); lint: only the known base boundary
  failure in `insurance-rules/aliases/door-shapes.test.ts`.

## Comments

- A SQL panel draws its rows as a table whatever its `chart.type` (as 890's item page does); drawing the stored chart
  type (kpi, line, bar, ...) from a SQL result is not built.
- The copilot's report tools and the designer cannot add a SQL block yet (BackOffice 3677 Comments); one already in a
  report is kept through a save (sent back as `{ id, kind: "panel", viewId, engine }`, the server drops `engine`).
- Not driven in a browser (no SIS.Api with 3675-3677 on this box): the screens are verified by typecheck and the pure
  module only.
