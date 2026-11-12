---
status: done
spec: BackOffice .issues\3632-sql-mode-the-copilot-writes-and-runs-one-guarded-select-and-its-answer-can-be-saved-spec.md
blocked-by: BackOffice 3673, BackOffice 3674
---

# 888 — The panel's SQL mode toggle, the "Try in SQL mode" offer, and a SQL answer with its mark, rows and statement

## What to build

BackOffice spec 3632, its web half for the panel (Q27, Q28, Q33).

- The SQL mode toggle, shown only to a reader the server says holds the SQL grant; a question asked with it on says so.
- The "Try in SQL mode" offer under a can't-answer; a tap asks the same question with the mode on.
- A SQL answer: the "SQL, not a certified figure" mark, every row, the statement (collapsed, with copy), the tables
  read, the count, the time, the cut line, and Save and Edit.

## Proof (→ `tdd` red-green cycles)

- [x] The toggle shows for a grant holder only and sends the mode · oms-react tests
- [x] The offer's tap re-asks with the mode on · oms-react tests
- [x] A SQL answer draws the mark, the rows, the collapsed statement with copy, and the tables read · oms-react tests
- [x] An answer with no SQL part draws as today · oms-react tests

## Boundaries

Follows the contract written by BackOffice 3673 and 3674.

## Done when

The Proof boxes are ticked.

## Blocked by

BackOffice 3673, BackOffice 3674

## Build notes

Built 2026-11-12 on `t888` (from `spec/3632`), test-first: `src/features/copilot/sql-mode.test.ts` (15, red before
green), against the wire in BackOffice 3673/3674/3672's Build notes, written into `src/core/models/copilot.ts`
(`CopilotAskRequest.sqlMode`, `CopilotAnswer.sql` / `sqlOffer`, `CopilotSqlPart`, `CopilotSqlOffer`) and
`src/core/models/analytics.ts` (`AnalyticsAccess.canSql?`, absent = denied).

- **Toggle (Q27).** `access.ts`: `canUseSqlMode` (`canSql === true`) over the panel's own `GET Analytics/Access` read
  (`COPILOT_SQL_ACCESS_KEY`; the copilot cannot import the analytics feature's probe), reset on a user change beside the
  copilot probe. The toggle lives in the conversation store (`sqlMode` / `setSqlMode`, off at start and on a user
  change) so it outlives the sheet; the panel draws it beside Send only on `canSql` and sends
  `ask(question, sqlOn)` -> `askBody(..., sqlMode)` -> `sqlMode: true`, nothing otherwise. A question asked in SQL mode
  says "Asked in SQL mode" under its bubble (in flight: the store's `inFlight.sqlMode`; in the thread: its reply has `sql`).
- **Offer (Q28).** `copilotAnswerModel(...).sqlOffer`; "Try in SQL mode" under a can't-answer. The tap is the store's
  `trySqlOffer`: toggle on, the offer's question asked with `sqlMode: true` in the conversation; a `null` id starts a new
  conversation first (the old one filed in the history, as "New conversation").
- **SQL answer (Q33).** `copilotAnswerModel(...).sql` (rows read to the columns, a non-text cell is NULL; a part with no
  statement text or rows list is none) and the layout part `sql`, right under the text. `AnswerParts.SqlAnswer`: the
  "SQL, not a certified figure" mark, count and time (or "No statement ran."), the cut line, every row (scrolling box),
  the tables read, and the statement folded in a `<details>` with its own Copy. `describe_tables` / `run_sql` have
  lookup and working-step words. en + ar words (`sql.*`).
- **Save and Edit are NOT drawn** (absent, not inert): they belong to 889 (save dialog) and 890 (editor). 889/890 add
  them to `SqlAnswer`'s footer; the part they need is `CopilotAnswerModel.sql` (`statement`, `columns`, `rows`), and the
  editor's toggle gate is the same `canUseSqlMode`.

Gates: typecheck green; `npm test` 751 files / 10324 tests green; lint: only the base's four boundary violations in
`insurance-rules/aliases/door-shapes.test.ts`, the other four checks green. Not driven in a browser (no SIS.Api with
SQL mode on this box; RTL not installed): the components are thin renderers over the tested model and store.
