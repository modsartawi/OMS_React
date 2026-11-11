---
status: done
spec: BackOffice C:\Work\DMSCO\BackOffice\.issues\3587-the-copilots-analysis-tools-what-changed-against-the-others-and-the-headline-spec.md
blocked-by: BackOffice 3621, BackOffice 3607
---

# 878 — The panel shows an analysis result's tables with their titles, and last year where a table carries it

## What to build

BackOffice spec 3587, B22 and B13; tickets 3621 and 3607.

- An answer table that carries a title shows it above the table, in the panel's language. A table without a title
  renders exactly as today.
- Several tables of one analysis (one per cut) are shown in the order the server sent them, each under its title.
- Columns the analysis computed (the share of the change, the rank, the gap to the median) are shown as the server
  sent them: the panel does not compute or re-format a figure.
- "Open as a view" opens the table's own query. The columns the analysis computed are not part of that query, and
  the panel says so in one short line.
- A table that carries last year's rows shows them the way the query builder's table does (877).

## Proof (→ `tdd` red-green cycles)

- [x] A table with a title shows it in the panel's language; one without renders as today · oms-react tests (the panel's answer tests) · `copilot-analysis-table.test.ts`: `aTableWithATitle_showsItInThePanelsLanguage`, `aTitleWithNoArabic_readsInEnglish_ratherThanBlank`, `aTableWithoutATitle_drawsNothingAboveIt_asToday`, `aPlainQuerysTable_isDrawnAsBefore_numbersFormattedByTheTableForm`; `copilot-table.test.ts` and `answer.test.ts` untouched
- [x] Three tables of one answer are shown in order, each under its own title · oms-react tests · `theAnswerKeepsThem_inTheOrderSent_eachWithItsOwnTitle`, `eachIsKeyedByItsPlaceAsWellAsItsStep_soNoTwoShareAKey`, `thePanelDrawsThem_inTheOrderSent_eachGivenItsOwnTableAndItsPlace`, `threeTablesOnOneStep_areToldApartByTheirPlace`
- [x] A computed column is shown as sent, and sorting by it works · oms-react tests · `everyCell_isTheServersText_asSent_neverReformattedOrComputed`, `theShare_sortsByNumber_andEveryCellStillReadsAsSent`, `theChange_sortsByNumber_negativesBelowPositives`, `table-columns.test.ts`
- [x] "Open as a view" opens the table's query, with the one-line note when the table has computed columns · oms-react tests · `opensTheTablesOwnQuery_withoutTheColumnsTheAnalysisComputed`, `theNote_saysSoInOneLine_inBothLanguages`, `aPartFromNoSingleQuery_offersNoOpenAsView_andNoNote`, `aPlainQuerysTable_isOfferedOpenAsView_asToday_andNeverHasTheNote`
- [x] A table with last year's rows shows the last-year column · oms-react tests · `aTableWithLastYearsRows_showsTheLastYearColumn_asTheQueryBuildersTableDoes`, `lastYearNotHeld_drawsNoColumn_andTheNoteSaysTheDayTheDataStarts`, `thePreviousPeriodsDays_withoutItsRows_drawNoComparisonColumn`

## Boundaries

Switched by the server (`Copilot:Analysis:*` and the speed spec's panel tables): with the switches off the panel
sees today's answer and behaves as today. Pure-function tests, where the panel's answer tests already are.

## Done when

Proof boxes ticked.

## Blocked by

BackOffice 3621, BackOffice 3607

## Build notes (2026-11-11)

Built on branch `impl/3587-878`, commit `da24168e`, merged into `spec/3587-analysis-tools` (fast-forward). Not
pushed.

**Tests.** `npx vitest run` over the whole repo: 10221 passed before, 10276 after (55 new, in four new files:
`copilot-analysis-table.test.ts` 35, `copilot-table-embed.test.ts` 9, `table-columns.test.ts` 8,
`answer-tables.test.ts` 3). No existing test file changed. Typecheck clean; the gates' output is unchanged (the
boundaries gate was already red). Thirteen mutation checks were each caught. **Not seen in a browser:** the grid
draws its rows only in a browser, so the header-click sort and the look of text cells are proven at the
column-definition level only.

### Decisions

- **An analysis table is one that carries a `title`.** Only those take the as-sent path; every other table goes
  through today's code unchanged.
- **Keys.** A table is keyed by its step and its place in the answer. A titled table downloads as
  `analytics-copilot-<step>-<place>`; an untitled one keeps today's file name.
- **Sorting a computed column.** The row holds the server's text itself, with no formatter and no cell bar. The
  grid's comparator orders by the first number in each text ("62.0%" is 62, "-620" is −620; thousands commas and a
  typographic minus are read). A cell with no number sorts below every figure. To prove it without a browser, the
  table form's column building moved from `TableChart.tsx` into `table-columns.ts`, unchanged for ordinary columns.
- **Downloads of an analysis table** write the texts as sent. **The xlsx cells are therefore text, not numbers, so
  Excel will not total them.** The sheet is named by the title.
- **"Open as a view"** opens the table's own query. When the table has columns that are not in that query, a
  one-line note sits under the toolbar:
  - EN: "Open as view shows the table's query only, without {{columns}} (computed by the analysis)."
  - AR: "«فتح كعرض» يعرض استعلام الجدول فقط، دون {{columns}} (من حساب التحليل)."
- **When the table's query is empty:** no "Open as view" and no note; the table, its title and both downloads stay.
- **Last year:** the table's `lastYear`, its dates and `notes.lastYearNotHeld` go through the same reader as the
  query builder's table, so 877's column, dated header and not-held note apply as they are. An analysis table's
  comparison days with no rows draw no comparison column.
- A change column from last year whose header the server left as its key is headed "Change in {measure} from last
  year".

### Not done

- An analysis table does not show the days it compares with; the ticket did not ask for it.
- The Arabic wording of the note is the implementer's and not reviewed.
