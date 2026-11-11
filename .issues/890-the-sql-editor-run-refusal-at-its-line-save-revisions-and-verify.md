---
status: done
spec: BackOffice .issues\3632-sql-mode-the-copilot-writes-and-runs-one-guarded-select-and-its-answer-can-be-saved-spec.md
blocked-by: BackOffice 3672, BackOffice 3676
---

# 890 — The SQL editor runs a statement, shows a refusal at its line, saves revisions, restores one, and a curator verifies

## What to build

BackOffice spec 3632 Q44, Q45: the editor for a SQL item: the statement, Run (the door), the result, a refusal's reason
at its line and column, Save (a new revision), the revisions with their authors and Restore. A curator's Verify and
Unverify.

## Proof (→ `tdd` red-green cycles)

- [x] Run shows rows, or the refusal at its line · oms-react tests
- [x] Save and Restore call their doors and list the revisions · oms-react tests
- [x] Verify shows for a curator only · oms-react tests

## Boundaries

Follows the contract written by BackOffice 3672 and 3676.

## Done when

The Proof boxes are ticked.

## Blocked by

BackOffice 3672, BackOffice 3676

## Build notes

Built 2026-11-12 on `t890` (from `spec/3632`, with 889 merged in), test-first:
`src/features/analytics/boards/sql-editor.test.ts` (18, three slices, each red before green) plus 2 in
`src/features/copilot/sql-save.test.ts` and 1 in `src/core/analytics-routes.test.ts`, against the wire in BackOffice
3672/3675/3676's Build notes, written into `src/core/models/analytics-sql.ts` beside 889's types (`AnalyticsSqlResult`,
`AnalyticsSqlRefusal`, `AnalyticsSqlItemRun`, `AnalyticsSqlItem`, `AnalyticsSqlItemUpdate`, `AnalyticsSqlEditorSeed`)
and `AnalyticsItem.engine` / `verified` in `analytics.ts`.

- **Gate.** `access.ts` `canEditSql` = `canView && canSql === true` on the feature's own `GET Analytics/Access` probe
  (the copilot keeps its `canUseSqlMode`; a feature may not import another).
- **Run (Q45).** `analyticsApi.sqlRun` -> `POST Analytics/Sql/Run { statement }`; `sql-editor.ts` reads the rows
  (`readSqlResult`, `sqlCells`: NULL stays null) and the refusal (`sqlRunRefusal`: 425/408/409 with `data.reason`,
  428 as `needs-sql-grant`); `refusalSpot` cuts the statement's line at the parser's column, and `SqlRefusalNote`
  marks that character. A save's own run refusal shows the same way.
- **Save, revisions, Restore (Q45).** `saveSqlItem` -> `PUT Analytics/Item/{id}` with `{ definition: { statement,
  question, chart }, baseRevision }` (question and chart kept); `sqlRevert` -> `…/Revert`; a new statement (the
  copilot's Edit) saves through `createSqlItem` -> `POST Analytics/Item/Sql` with a title, then opens its own editor.
  The revisions are `ItemHistory` (gained a `may` override: a SQL item's edit rule is not the tier's). 🚩 Fixed on the
  way: `readRevisions` read `updatedBy`/`updatedAt`, but the server's `AnalyticsRevisionInfo` sends
  **`savedBy`/`savedAt`**, so every revision listed with no author; both spellings are read now.
- **Verified (Q44).** `sqlItemActions`: edit for the owner with `canSql` or a curator (with `canSql`, as every write
  runs the statement); `verify` / `unverify` for a curator only, by the mark, never both; the server's `actions`, when
  sent, can only take one away. `sqlVerify`/`sqlUnverify` -> `…/Verify`, `…/Unverify` (no body). Before a save that
  changes a verified statement (ordinal, as the server compares) the editor says the mark will go.
- **Screens.** `AnalyticsSqlEditorPage` at `/analytics/sql/:id` and `/analytics/sql/new` (statement + question in route
  state, `NEW_SQL_PATH` / `sqlEditHref` in `core/analytics-routes`); a reader without the grant sees it read only.
  `/analytics/view/:id` on a SQL item (`engine: "sql"`) now draws `SqlItemView` (title, mark, kept result or refusal,
  folded statement, **Edit**) instead of asking `Analytics/Query` for it. The copilot's SQL answer footer has **Edit SQL**
  beside 889's Save (a `Link` by route string, `sqlEditLink`, SQL grant holders only, shown even when nothing ran).
- en + ar words: `boards:sqlEditor.*`, `copilot:sql.edit`.
- Gates: typecheck green; `npm test` 753 files / 10357 tests green; lint: boundaries only the known base failure in
  `insurance-rules/aliases/door-shapes.test.ts`, the other four gates green.
- Not driven in a browser (no RTL; no live SIS.Api with 3672/3675/3676 on this box): the screens are thin renderers over
  the tested module.

## Comments

- For 891: `SqlItemView` is a plain drawing of a SQL item on the view page (the table, not the saved chart type), so the
  Edit entry has a home; the "SQL" / "SQL, verified" marks elsewhere, the chart, and the "filters do not apply" /
  "can no longer run" messages are 891's. The mark words are in `boards:sqlEditor.mark` / `markVerified`.
- `GET …/History`'s new `verify` / `unverify` / `verify-removed` entries are not listed by the web: `ItemHistory` reads
  `…/Revisions` only.
