---
status: done
spec: BackOffice C:\Work\DMSCO\BackOffice\.issues\3587-the-copilots-analysis-tools-what-changed-against-the-others-and-the-headline-spec.md
blocked-by: BackOffice 3604, BackOffice 3605
---

# 876 — An author turns on "same weeks last year" in the query builder, beside the previous period

## What to build

BackOffice spec 3587, B7, B10 and B12; tickets 3604 and 3605.

- The query builder has a switch for the comparison with the same weeks last year, beside the one for the previous
  period. An author may turn on either or both.
- A `change` calculation can be set to be taken from last year. The builder offers that choice only when the
  last-year comparison is on, and turns the comparison on when the author picks it.
- The option is saved with the view, the board panel and the report block, and comes back when the definition is
  opened again.
- A board's own comparison setting covers last year as it covers the previous period.
- A definition that does not ask for last year is saved and sent exactly as today.

## Proof (→ `tdd` red-green cycles)

- [x] Turning the switch on puts the option in the query the builder sends · oms-react tests (the builder's query tests) · `compare-last-year.test.ts`: "the view editor stores compareToLastYear when it is on, alone or beside the previous period", "the report panel editor stores it the same way…", "the request asks for last year when the definition compares to it…"
- [x] A saved definition with the option opens with the switch on · oms-react tests · "the view editor opens a saved view with the last-year switch on…", "a report block opens with the switch on…", "a board panel shows a saved view…"
- [x] A `change` from last year is offered only with the comparison on, and picking it turns the comparison on · oms-react tests · "picking it turns the last-year comparison on, and the calculation names its comparison as the wire expects", "is never kept with the last-year comparison off…"; the choice is offered once EITHER comparison is on (see Build notes: the ticket's two clauses could not both hold)
- [x] A definition without the option is sent as today · oms-react tests · "the builder builds today's definition, byte for byte, when last year is never touched", "opening it, re-fitting it and leaving the switch off change nothing", "the request, and so the panel's cache key, are today's"
- [x] The switch and the choice have their Arabic labels · oms-react tests · "every new sentence is written in both languages, with the same placeholders", "the switch reads as last year's…", "a change from last year is named apart…"

## Boundaries

No server switch: the door accepts the option for every caller. The wire names are in the Build notes of BackOffice
3604 and 3605.

## Done when

Proof boxes ticked.

## Blocked by

BackOffice 3604, BackOffice 3605

## Build notes (2026-11-11)

Built on branch `impl/3587-876`, commit `70f7a7dc`, merged into `spec/3587-analysis-tools` (fast-forward), which
is cut from `spec/3558-copilot-speed`. Not pushed.

**Tests.** `npx vitest run` over the whole repo: 10166 passed before, 10184 after (18 new, all in
`src/features/analytics/boards/compare-last-year.test.ts`). Typecheck clean. The design gates pass; the boundaries
gate was already red before this ticket (4 violations in `insurance-rules/aliases`) and is unchanged. Six mutation
checks were each caught. **Not verified in a browser:** the four `.tsx` changes are covered by typecheck only.

### Where the ticket and the build differ

**The `change` choice.** The ticket says both "offered only when the last-year comparison is on" and "turns the
comparison on when the author picks it"; one control cannot do both. Built: the `change` kind is offered once
either comparison is on; its "Compared with" field lists both comparisons; picking one that is off turns its switch
on, and the form says so first. Switching last year off removes a change from last year, with a note. Nothing the
server would refuse is ever saved.

### Decisions

- The switch is a second chip directly under the previous-period chip, in the view editor and the report panel
  editor, on the same chart types (KPI, line, table, bars). The two switches are independent.
- Only `from: "lastYear"` is written; a change from the previous period carries no `from`.
- A new change from last year is keyed `change_ly_<measure>`; a saved change moved between comparisons keeps its key.
- There is no board-level setting in the web: the board's request carries the option when the panel's view has it.
- Two existing strings were reworded, since a change is no longer from the previous period only
  (`editor.calc.kindName.change`, `editor.calc.why.needsCompare`).

### New labels

| Key | English | Arabic |
|---|---|---|
| `editor.compareLastYear` | Compare with the same weeks last year | المقارنة بالأسابيع نفسها من العام الماضي |
| `editor.compareLastYearHint` | Last year is the same days, 364 days earlier, so every day falls on the same weekday. | العام الماضي هو الأيام نفسها قبل 364 يومًا، فيقع كل يوم في اليوم نفسه من الأسبوع. |
| `editor.calc.from` | Compared with | مقارنةً بـ |
| `editor.calc.fromName.previous` | The previous period | الفترة السابقة |
| `editor.calc.fromName.lastYear` | The same weeks last year | الأسابيع نفسها من العام الماضي |
| `calculation.label.changeLastYear` | Change in {{measure}} from last year | التغير في {{measure}} عن العام الماضي |

### For 877 and 878

- Types: `compareToLastYear?` on the query types; `AnalyticsQueryResult.lastYear?` and `lastYearPeriod?` (absent
  when not asked, unlike `previous`); `AnalyticsChangeFrom`, `AnalyticsCalculation.from?`,
  `AnalyticsColumnCalculation.from?`. `readResult` already reads the result's two fields.
- A change-from-last-year column is already labelled apart (`CalculationWords.changeLastYear`).
- Helpers: `comparisonsOf`, `withLastYear` (`editor.ts`); `comparingLastYear`, `withComparingLastYear`
  (`panel-edit.ts`); `changeFromOf`, `changeFroms` (`calculations-edit.ts`); `comparing(view)` returns both options.
- **Nothing draws last year yet:** `series-view.ts`, `previous-rows.ts`, `panel-table.ts` and
  `SeriesPanel.drawsAsSeries` read `previous` only. The server's "not held" field is not typed or read.
- `tools/analytics-stubs.mjs` answers `compareToPrevious` only.
