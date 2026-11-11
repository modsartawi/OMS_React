---
type: wayfinder-ticket
wayfinder: grilling
map: 793
status: done
blocked-by: —
---

# 801 — What is a report, and how does it differ from a view and a board?

## Question

v1 saves **views** (one chart) and **boards** (a grid of views with filters). The owner works
from the copilot and has to jump from view to view; there is no single thing to save, share,
re-run or email. Settle:
- **Is a report a new item kind, or a board grown up?** A report reads top to bottom (title,
  parameters, sections of charts and tables, short narrative), prints and emails well. A board is a
  live grid for a screen. Decide whether they are one item with two layouts, or two kinds.
- **What a report holds:** its parameters (from 797), sections, panels by reference or inline,
  and text blocks. Whether a text block may hold AI-written commentary that is re-written on every
  run, and how that commentary is kept to figures in the report (no invented number).
- **Template versus run:** the saved report is the template; a run is the template plus parameter
  values at a time. Whether runs are kept (a history of what was emailed) or recomputed.
- **Tiers and teams:** reports follow the same Personal, Shared and Certified tiers and the team
  decision (794).

Record *report*, *report run* and any renamed terms in `CONTEXT.md` via `/domain-modeling`.

## Answer

Done 2026-11-06 (grilling). The owner chose the four rulings that shape a report (1–4). The rest
are the agent's, and the owner may overrule any of them.

**What was inherited.** The CTO demo already ships a *copilot report* (`AnalyticsReportPage`,
`ReportDocument`, the print route `/analytics/print/report/:id`, and `GET Analytics/Report/{id}`,
served only by the demo bridge in `C:\Playground\demo766`; BackOffice has no such door). It is a
**frozen document**. `build_report` writes headings, text and **table cells as strings**, and only
its charts re-run, through saved views. Its numbers go stale the next day and ignore parameters.
v2 keeps the demo's look (A4 width, print page, its own language) and replaces its content model.

1. **A report is its own item kind, sharing the board's container core (owner).** It has
   `kind: 'report'` beside `view` and `board`. It shares with the board:
   - parameters and bindings (797) and the one strip;
   - audience and tiers (794);
   - revisions, the conflict rule (`ANALYTICS-405`) and revert;
   - the panel query `{item, revision, panel, values}`.

   It reads top to bottom: a title, the strip, then **ordered sections**, each a heading and its
   blocks. It has no grid, no x/y, no TV mode, no auto-refresh and **no cross-filter**, so the
   screen and the email show the same thing. Schedules (803), the summary block (item 3) and the
   print page are the report's alone. A board is never scheduled or emailed.
2. **Panels are inline and owned by the report (owner).** Each chart or table block holds its own
   view definition (the v1 view shape plus 799's named series). An author may start a block **from
   a saved view**: it is copied, and `from {viewId, revision}` is recorded so the editor can say
   "the original changed since you copied it" (story 64's rule). Nobody else's edit or deletion
   changes what a schedule sends. The AI composing a report (802) creates no Personal views. The
   audience is checked once, on the report. Certifying freezes the whole report as one unit.
   - **There are no static data tables.** A table is a panel with chart type table, run like any
     other. The demo's `head/rows` string tables are gone.
   - The validator, shape rules, caps and `ANALYTICS-411` apply to each inline panel, as to a
     view.
3. **Words: live figures plus an optional AI summary (owner).**
   - **Text blocks** are the author's own words (English and Arabic, as data). They may hold
     **live figures**: a token naming a panel in this report and one of its single values (a KPI
     figure, or a total). The server fills it from that run's results with the measure's format,
     isolated as a machine value. A token that names a missing panel or a non-single value is
     `ANALYTICS-411` at save. A text block never holds a typed number the server cannot trace.
   - **At most one summary block** per report: the AI rewrites it on every run, **from that run's
     panel results only**, in the report's language. After writing, the server checks **every
     number in it** against the run's result set (after rounding to the displayed format). On any
     mismatch, an empty result or a model failure, the block is replaced by "summary unavailable"
     and the rest of the run goes on. A failed summary never stops a scheduled send (the same rule
     as 803's charts). Every rewrite is an audited AI call, under the owner's identity. Only an
     author may add the block; a runner sees its output.
4. **The saved report is the template. Sent runs are kept (owner).**
   - A **report run** is the template at a revision, plus parameter values, at a time.
   - **On-screen runs are recomputed** and never stored. The permalink carries the values (797).
   - **Every scheduled or emailed run keeps a record:** the template revision, the parameter
     values, the data-as-of time, the trigger (schedule or "send now"), the recipients, the
     outcome, and the summary text. **What was sent (the HTML body and the PDF) is kept for 90
     days**, so "what did we email on Tuesday" can be answered. The record outlives the artefact.
   - Only the owner, curators and the run's own recipients may open a kept run.
5. **Tiers and teams follow 794 unchanged.** Personal, Shared (with an audience) and Certified. A
   runner runs a report and changes its parameters. An author may Save as my copy. Certification
   stays for everyone (the fog item stands).
6. **Moving between kinds.** "Save as report" on a board copies its view panels into one section
   as inline blocks, in reading order. Its text and section panels become text blocks and section
   headings, and its parameters and bindings are copied. There is no conversion back. The demo's
   copilot reports are not migrated, because they never existed outside the demo bridge.
7. **The door.** `Analytics/Report/{id}` becomes the report kind under the shared `Analytics/Item`
   doors. The exact wire stays in the map's "How the analytics store changes" fog.

**Not WebI or Stimulsoft (owner asked, 2026-11-06).** There is no banded designer, no SQL, no
joins and no free-form layout. An author composes from the semantic model's ready-made measures
and dimensions. The only cross-area figures are the ones BackOffice declares (799's `store_day`).
How the designer *feels* is the prototype's
([How does an author declare a parameter, and a viewer run the report with it?](798-how-does-an-author-declare-a-parameter-and-a-viewer-run-the-report-with-it.md)).

New terms in `CONTEXT.md`: **Report**, **Report run**, **Live figure** and **Report summary**.
**Board** no longer lists "report" under Avoid.
