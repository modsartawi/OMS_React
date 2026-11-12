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

## Review fixes

From BackOffice spec 3632's review (3680 `## Review fixes (items, copilot)`, wire in 3673/3676/3678 Build notes), branch
`t3632-review`. Each test-first, red seen.

- **The authored statement is saved (review item 14).** The answer's SQL part reads `sql.authoredStatement` (the model's
  statement before the server's layout and its `TOP 1001` cap), kept only when sent. `sql-save.ts` `keptStatement` is it,
  falling back to `sql.statement` for an older server; the save dialog's `sqlSaveBody` and the answer's Edit (`sqlEditLink`)
  both use it. Tests `sql-save.test.ts` "Save sends the statement as authored", `sql-mode.test.ts` "reads the statement as
  authored".
- **Verify names its base revision (review items 5, 8).** `analyticsApi.sqlVerify(id, baseRevision)` posts
  `{ baseRevision }` (`AnalyticsSqlVerifyBody`); the editor sends the revision on screen. `ANALYTICS-405` is read by
  `saveRefusal` and said as "This item changed since you opened it: <who> saved revision <n> at <when>", and the item is
  reloaded. `sqlItemActions` gains `revisions` (the same rule as `edit`, under the server's `revisions` action), and
  `ItemHistory` follows it, so a curator the server gives `verify` alone gets Verify and no edit or revisions. Tests
  `sql-editor.test.ts` "Verify posts the revision the curator read", "Verify on a stale revision", "a curator the server
  gives verify alone".
- **Change by asking (Q46, BackOffice 3678).** On a SQL item's page (`SqlItemView`) and in its editor, `ChangeByAsking`
  shows when the item's actions include `edit`, the copilot is available and the reader holds the SQL grant
  (`sql-editor.ts` `changeByAsking`). It calls `@/core/copilot-panel` `openSqlItem({ itemId, revision })` (the features
  do not import each other). The panel takes it once, and the conversation store's `openSqlItem` starts a new
  conversation (the old one filed), turns SQL mode on and holds the item: the first question asked in SQL mode carries
  `sqlItemContext { itemId }`, follow-ups do not. A note above the box says nothing is saved. `COPILOT-456` has its own
  words. In that conversation the answer's Save-as-new is not offered; its Edit ("Edit and save the item") opens the
  item's own editor with the statement and the revision it was opened at, and Save there is the item's
  `PUT Analytics/Item/{id}` at that `baseRevision` (a save in between is `ANALYTICS-405`). A new conversation, a resumed
  one or a user change drops the item. Tests `copilot-panel.test.ts` "openSqlItem", `sql-mode.test.ts` "a SQL item
  opened in the copilot", `sql-save.test.ts` "Edit, in a conversation that opened a SQL item", `sql-editor.test.ts`
  "Change by asking", "Save from the copilot".

Gate: `npm run typecheck` clean; `npm test` 754 files, 10380 tests green; `npm run lint` only the known boundary failure
in `src/features/insurance-rules/aliases/door-shapes.test.ts` (the other four checks pass).

## Comments

- For 891: `SqlItemView` is a plain drawing of a SQL item on the view page (the table, not the saved chart type), so the
  Edit entry has a home; the "SQL" / "SQL, verified" marks elsewhere, the chart, and the "filters do not apply" /
  "can no longer run" messages are 891's. The mark words are in `boards:sqlEditor.mark` / `markVerified`.
- `GET …/History`'s new `verify` / `unverify` / `verify-removed` entries are not listed by the web: `ItemHistory` reads
  `…/Revisions` only.
