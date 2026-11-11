---
type: spec
status: ready
map: 793
---

# 819 — HQ analytics v2: parameterised team reports, over more sources, composed by the AI and emailed on a schedule

Settled for [HQ analytics v2: team reports with parameters, over more sources](793-hq-analytics-v2-team-reports-with-parameters-over-more-sources-map.md)
on 2026-11-06. It builds on [HQ self-service analytics v1](766-hq-self-service-analytics-v1-spec.md) and
changes none of v1's standing constraints:
- **The stack, from [ADR 0006](../docs/adr/0006-analytics-is-native-screens-over-cube-and-dbt-marts.md):**
  dbt marts in `POS_Analytics`, Cube Core as the only engine, SIS.Api as the gate and the store, and
  oms-react drawing everything with Recharts, all on-prem.
- **No PII member** is ever declared in the semantic model.
- **The model is changed only by a BackOffice pull request.**
- **The AI** writes structured definitions, never SQL, and every AI call is audited.
- **v1's caps** of 30 s, 10,000 rows and 92 days for percentiles stand until 750 measures otherwise.

Like 766, this one spec carries **both halves**. The web half is built here. The server half is a set
of **BackOffice asks** (Further Notes). Each server shape below is **proposed**, and the BackOffice
spec that takes it becomes its normative owner. ⚠ **Drift rule (unchanged):** a `400` on a web
ticket's first live call is a drift report. Correct the BackOffice spec first, then this
transcription, never the transcription alone.

Sources (the detail and reasoning live in each; this spec does not restate them):
- **Teams:** [Who is a team when an analytics item is shared, and what may the team do with it?](794-who-is-a-team-when-an-analytics-item-is-shared-and-what-may-the-team-do-with-it.md)
- **Parameters, the research:** [How do Cube and comparable BI tools model run-time report parameters?](795-how-do-cube-and-comparable-bi-tools-model-run-time-report-parameters.md),
  with notes in [793-run-time-parameters.md](../docs/research/793-run-time-parameters.md)
- **The new areas:** [Which new subject areas does v2 add, and which HQ questions do they answer?](796-which-new-subject-areas-does-v2-add-and-which-hq-questions-do-they-answer.md),
  with the catalogue in [793-v2-semantic-model.md](../docs/research/793-v2-semantic-model.md)
- **Parameters, the rules:** [What parameters may an author declare, and how do they bind to panels?](797-what-parameters-may-an-author-declare-and-how-do-they-bind-to-panels.md)
- **The designer and the runner:** [How does an author declare a parameter, and a viewer run the report with it?](798-how-does-an-author-declare-a-parameter-and-a-viewer-run-the-report-with-it.md),
  prototyped on branch `prototype/793-parameters`, with shots in [798-shots/](assets/798-shots/)
- **Cross-area comparison:** [Does comparing across sources need cross-area measures in one view, or panels side by side?](799-does-comparing-across-sources-need-cross-area-measures-in-one-view-or-panels-side-by-side.md)
- **The replica:** [Which tables do the new areas need, and are they on the replica?](800-which-tables-do-the-new-areas-need-and-are-they-on-the-replica.md),
  with notes in [793-v2-sources-on-the-replica.md](../docs/research/793-v2-sources-on-the-replica.md)
- **The report kind:** [What is a report, and how does it differ from a view and a board?](801-what-is-a-report-and-how-does-it-differ-from-a-view-and-a-board.md)
- **The AI:** [How does the AI compose a whole report from one request?](802-how-does-the-ai-compose-a-whole-report-from-one-request.md)
- **Scheduled email:** [How does a scheduled report reach its recipients by email?](803-how-does-a-scheduled-report-reach-its-recipients-by-email.md),
  with notes in [793-scheduled-report-email.md](../docs/research/793-scheduled-report-email.md)
- **QC and cancellation:** [Which document sources and states define QC and a cancelled order?](804-which-document-sources-and-states-define-qc-and-a-cancelled-order.md),
  with notes in [804-qc-and-cancellation.md](../docs/research/804-qc-and-cancellation.md)

**Glossary.** `CONTEXT.md` defines every term this spec uses:
- **Sharing:** *audience*, *analytics author*, *runner*;
- **Parameters:** *parameter*, *binding*;
- **Comparison:** *named series*, *cross-area view*;
- **Reports:** *report*, *report run*, *live figure*, *report summary*, *report in context*;
- **From v1:** *analytics view*, *board*, *tier*, *curator*.

Copy never says "team" for an object, "template" for the item, "dashboard", "saved view", "card" or
"variable".

**The acceptance case** (the owner's own sentence, map 793):
> "How were sales for each channel yesterday? Focus on two order types, HungerStation and QC,
> compare them, and show their cancellation rates. The period is a parameter that defaults to
> yesterday and can be changed. Save it as a report template my team can re-run, schedule it every
> day by email to named people, and include charts."

## Problem Statement

v1 lets an HQ power user build analytics views and boards over four areas and share them with every
analytics user. Five gaps stop HQ from running its recurring reporting there:

- **Sharing is all or nothing.** A board for the delivery team is shared with the whole company or
  kept private. There is no way to say "these roles and these two people". Nor is there a way to let
  a team run a board without also letting them build.
- **A report can't take inputs.** v1's six board filters are fixed, so "the same report for last
  week", "for these five stores", "above 5 % cancellation" or "by region instead of by city" means
  a copy per variant. A filter a panel can't take is dropped silently, so a viewer can believe a
  number is filtered when it isn't.
- **The figures HQ asks about aren't in the model.** There is no cancellation rate, no QC (Dawaa
  Now express delivery), and no coupons, loyalty or insurance claims. Comparing figures from two
  areas in one chart is impossible.
- **There is no report.** A board is a wall-screen grid, not a document with words. Nothing reads
  top to bottom with figures in its sentences, prints to A4, or arrives by email each morning. The
  CTO demo's "copilot report" is a frozen document whose numbers go stale the next day.
- **The AI makes one chart at a time.** The owner's sentence above needs a whole report: several
  charts, two compared series, a period parameter and words. Today that is an hour of clicking.

## Solution

v2 adds **reports**, **parameters**, **audiences** and **new areas** to the native analytics screens,
and lets the copilot compose a whole report in one request.

- **A report** is a new item kind beside the view and the board. It reads top to bottom: a title,
  the parameter strip, then ordered sections of chart and table blocks, the author's text (with
  **live figures** the server fills in) and at most one **AI summary** that is number-checked on
  every run. It shares the board's core (parameters, audience, tiers, revisions), prints to A4, and
  can be **scheduled by email**.
- **Parameters.** An author declares seven kinds of input on a board or report:
  - period;
  - members;
  - grain;
  - threshold;
  - top N;
  - measure;
  - breakdown.

  Each has a default and explicit bindings to panels, pre-filled to match. A binding that cannot
  apply is refused at save, and a panel a parameter doesn't reach says so. v1's six board filters
  become the six ready-made parameters, so every v1 board and permalink still opens.
- **Audiences and grants.** A Shared item is shared with **everyone** or with **a mix of authz roles
  and named users**. Building becomes its own **author** grant. A **runner** opens what they're
  given, changes parameter values, exports and copies links, and never builds.
- **More sources:**
  - **Orders** gain cancellation (cancelled split from expired) and a **delivery type** dimension
    in which QC lives.
  - **New areas:** coupons and promotions, loyalty aggregates, and insurance claims (submitted
    amounts only).
  - **Comparison:** a view may hold **up to 4 named series**, each with its own filters (for
    example HungerStation = a channel against QC = a delivery type).
  - **Cross-area figures:** one curated **Stores by day** view holds till, orders and delivery
    figures together.
- **The designer** (from the 798 prototype):
  - An outline sits on the start side, the report is editable in place in the middle, and a fixed
    inspector sits on the end side.
  - Undo and redo, with no confirm dialogs.
  - Sections and blocks can be dragged and dropped.
  - A self-checking tutorial builds the acceptance case.
- **The AI** builds a whole report from one sentence and opens it in the designer as a private
  draft, listing what it assumed. With a report open in the designer, "add the cancellation rate as
  a bar" edits that report as one undoable step. It never shares, certifies or schedules; it links
  those steps instead.
- **Scheduled email:**
  - **Sending:** SIS.Api sends the report on a schedule to named analytics users in its audience.
  - **The body:** an HTML email of figures and tables, with a link back to the live report.
  - **Charts:** a PDF rendered from the print page.
  - **The record:** every sent run is kept, its record permanently and its artefacts for 90 days.

## User Stories

### Grants, audiences and sharing

1. As an HQ analytics author, I want to share a board or report with chosen authz roles and named users, so that the delivery team sees it without the whole company seeing it.
2. As an author, I want to share with everyone as before, so that company-wide items keep working the v1 way.
3. As an author, I want to pick roles from the ones the Authz admin screen already manages, so that I never maintain a separate team list.
4. As an author, I want to search for a user by name or employee id when adding them to an audience, so that I can add one person outside the role.
5. As an author, I want a role that was later deleted to show as "removed" in my audience, so that I know why someone lost access.
6. As a member of an audience, I want to lose access the moment I leave the role, so that access always follows authz.
7. As a Shared item's viewer, I want to see an audience chip (everyone, or the roles and users), so that I know who else sees the same figures.
8. As a user outside an item's audience, I want a link to it to say "not shared with you" and name the owner, so that I know whom to ask, without seeing its title or data.
9. As a user with no analytics grant, I want the same no-access state as v1, so that nothing changes for me.
10. As a runner, I want to open items shared with me, Certified items and items shared with everyone, so that I can run what my team needs.
11. As a runner, I want no builder, chart editor, AI tools, save or copy anywhere, so that the screens show only what I can do.
12. As a runner, I want to change parameter values, cross-filter, export, use fullscreen, the table view and TV mode, and copy a permalink, so that I can run the report my way.
13. As an author in an item's audience, I want "Save as my copy", so that I can build my own variant without touching the original.
14. As a curator, I want to narrow an item's audience or unshare it, so that I can correct an over-wide share.
15. As an owner, I want every audience change written to the item's history, so that "who shared this with whom, when" can be answered.
16. As an owner, I want an audience change never to clash with an edit I'm saving, so that sharing and editing don't block each other.
17. As a curator, I want to hand an item to another author when its owner has lost the author grant, so that a team's report isn't stranded when someone moves on.
18. As an owner who loses the author grant, I want my items to stay where they are and keep running for their audiences, so that a role change doesn't break my team's reporting.

### Parameters: declaring

19. As an author, I want a new board or report to start with the six ready-made parameters (period, city, region, store, channel, country), so that the common inputs are already there.
20. As an author, I want to delete any ready-made parameter, so that the strip shows only what this report takes.
21. As an author, I want to add a parameter by picking one of seven kinds (period, members, grain, threshold, top N, measure, breakdown), so that I declare exactly the input I mean.
22. As an author, I want each kind to explain itself in one line when I pick it, so that I choose the right one.
23. As an author, I want to name the parameter's link key and see at once whether it is a valid slug, unique and not reserved, so that I never save a broken link.
24. As an author, I want to label the parameter in English and Arabic, so that both languages read naturally.
25. As an author, I want to set the default with the same control the viewer will use, so that what I set is exactly what they'll see.
26. As an author, I want every parameter to have a default, so that a scheduled run never meets an empty value.
27. As an author, I want to mark a parameter "viewers can't clear it", so that a figure always has, for example, a period.
28. As an author of a members parameter, I want to choose open search over every member or a pinned list, and one value or several, so that I control what viewers can pick.
29. As an author of a grain parameter, I want to choose which grains (day, week, month) are allowed, so that a 92-day percentile panel isn't offered a grain it can't take.
30. As an author of a threshold parameter, I want to pick one measure and enter the number in its display unit (5 %, not 0.05), so that I think in the units I read.
31. As an author of a measure or breakdown parameter, I want to list the options a viewer may switch between, and be refused at save if any option breaks a panel's shape, so that a viewer never picks a chart that can't draw.
32. As an author, I want a new parameter bound at once to every panel that can take it, so that I don't wire each panel by hand.
33. As an author, I want each panel that can't take a parameter to say why (no time axis, its series already filter that dimension, wrong shape for a threshold or top N, not in this area), so that I understand the gaps.
34. As an author, I want to unbind a panel, or point a members parameter at another dimension on that panel, so that one strip can drive panels from different areas.
35. As an author, I want an overview of parameters against panels (bound, unbound, can't, and why), so that I can check the whole report's wiring at a glance.
36. As an author, I want a binding that cannot apply refused at save with the parameter and panel named, so that nothing is ever dropped silently.
37. As an author of a v1 board, I want it to open in v2 with its filters as defaults and its implicit filter rule turned into explicit bindings, so that nothing I built changes meaning.

### Parameters: running

38. As a runner, I want one parameter strip at the top of a board or report, so that every input is in one place.
39. As a runner, I want each kind to have its own fitting control (a period picker, a searchable member list, grain chips, an operator plus a number, a top N stepper, a measure or breakdown choice), so that changing an input is quick.
40. As a runner, I want "Reset to defaults", so that I can get back to the author's report in one click.
41. As a runner, I want a panel a parameter I changed doesn't reach to say "not filtered by …", so that I never misread a number.
42. As a runner, I want my parameter values in the link I copy, so that a colleague opens exactly what I see.
43. As a runner opening an old v1 permalink, I want it to still open with the same filters, so that bookmarks and wall screens keep working.
44. As a runner opening a link with a value outside a parameter's list, I want it to fall back to the default and tell me, so that a stale link still opens.
45. As a runner entering a value the server rejects, I want the parameter named and the reason given, so that I can correct it.
46. As a runner, I want only the panels whose effective query changed to re-run, with v1's loading feedback, so that changing one input stays fast.

### New figures and areas

47. As an HQ analyst, I want a cancellation rate on orders (cancelled ÷ all orders, by order date), so that I can track cancellations by channel.
48. As an analyst, I want expired orders counted apart from cancelled ones, so that auto-expiry doesn't inflate the cancellation rate.
49. As an analyst, I want a "cancelled by" breakdown (customer or app, store, courier, platform), so that I can see who cancels.
50. As an analyst, I want recent days of the cancellation rate marked "may still rise", so that I don't read an incomplete day as an improvement.
51. As an analyst, I want HungerStation cancellation figures labelled "inside OMS only", so that I know platform-side cancels aren't counted.
52. As an analyst, I want a delivery type dimension with QC on orders, deliveries and till sales, so that I can ask about Dawaa Now express anywhere.
53. As an analyst, I want call-centre orders to fall into their channel rather than "other", so that channel totals are right.
54. As an analyst, I want coupon and bonus-buy discount value and promoted share by store, channel and campaign, so that I can see what promotions cost and drive.
55. As an analyst, I want coupon redemptions net of reversals once the Coupons V2 tables reach the replica, so that redemption counts are exact.
56. As an analyst, I want loyalty points accrued, redeemed and expired, redemption value, enrolments, outstanding points and tier mix as aggregates, so that I can follow the programme without seeing any member.
57. As an analyst, I want insurance claims and their submitted payer and patient shares by store and payer, so that I can follow claim volume and value.
58. As an analyst, I want recent claim days marked "may still rise", so that the three-week submission lag isn't misread.
59. As an analyst, I want per-member points, approved or paid insurance amounts, diagnoses and coupon issuing to stay unanswerable, so that v2 never exposes what v1's bar keeps out.

### Comparing

60. As an author, I want up to 4 named series in one chart, each with its own filters and an English and Arabic label, so that I can put HungerStation (a channel) against QC (a delivery type).
61. As a viewer, I want each series' rate computed from its own query, so that a rate is never an average of averages.
62. As a viewer, I want no total across series, so that overlapping series are never double-counted.
63. As a viewer, I want each series in its own colour, in order, with a legend, so that I can tell them apart; that includes multi-series bars, which today draw in one colour.
64. As a viewer, I want clicking a series only to highlight it, not cross-filter, so that cross-filtering stays about members on the axis.
65. As a viewer, I want an exported table to carry a "series" column, so that the CSV and xlsx keep the comparison.
66. As an author, I want a Stores by day view holding till sales, orders, cancellations and deliveries per store, so that one table compares them across areas.
67. As a viewer of Stores by day, I want each figure to say which date it uses (sale, order or delivery creation), so that I read it correctly.
68. As a viewer, I want Stores by day to show its oldest source's freshness, so that one stale source isn't hidden.
69. As an author, I want panels from different areas side by side in one section, all driven by the same parameters, so that I can compare figures Stores by day doesn't hold.

### The report

70. As an author, I want to create a report from the home or the builder, so that I can start a document rather than a wall board.
71. As an author, I want sections with headings that I can add, rename, move and remove, so that my report has a structure.
72. As an author, I want to add a chart or table block to a section and edit it in the inspector (area, measures, axis, chart type, series), so that each block is built in place.
73. As an author, I want to start a block by copying a saved view, with "copied from … at revision n" shown, so that I reuse work without depending on someone else's edits.
74. As an author of a copied block, I want to be told when the original view has changed since I copied it, so that I can decide whether to copy again.
75. As an author, I want text blocks in English and Arabic, so that the report explains itself in both languages.
76. As an author, I want to insert a live figure into my text (a KPI or a total from a panel in this report) as a chip, so that my sentence always shows this run's number.
77. As an author, I want a live figure that names a missing panel or a non-single value refused at save, so that text never shows a number the server cannot trace.
78. As an author, I want to add one AI summary block, so that each run gets a short written reading of its results.
79. As a viewer, I want the AI summary to say "summary unavailable" when its numbers don't match the run, so that I never read a wrong figure; the rest of the report still shows.
80. As a viewer, I want a report's panels to show their caveats (for example "inside OMS only"), so that the report carries the model's warnings.
81. As an author, I want a board's content copied into a new report with "Save as report", so that I can turn a wall board into a document.
82. As an author, I want a report to print to A4 in either language, so that I can hand it out on paper.
83. As a runner, I want a report page with no edit control anywhere, so that I only run it.

### The designer

84. As an author, I want an outline of parameters and sections on the start side, the report editable in place in the middle, and a fixed inspector on the end side, so that I see the whole, the page and the detail together.
85. As an author, I want the inspector to be a pane, never a modal, so that it never covers the report or the tutorial.
86. As an author, I want every edit to be an undoable step (Ctrl+Z / Ctrl+Y and buttons), with typing in one field counted as one step, so that a mistake is one keystroke away from gone.
87. As an author, I want every removal to say "Removed … · Undo" and never ask for confirmation, so that removing is quick and safe.
88. As an author, I want to drag sections and blocks by a grip, in the outline or on the page, with a line showing where they'll land, so that reordering is direct; each drop is one undoable step.
89. As an author, I want keyboard move-up and move-down on every section and block, so that I can reorder without a mouse.
90. As an author, I want every add to have a matching remove wherever the thing is shown, so that nothing I add gets stuck.
91. As an author, I want after a save to rely on revisions and revert, so that I can go back past my unsaved session.
92. As a new author, I want a built-in tutorial that builds the acceptance case step by step, ticking each step from the report's own state, so that I learn by building.
93. As a new author, I want "Load the finished report" in the tutorial, so that I can see the end result at once.
94. As an author, I want a save refused with every problem listed and each one taking me to its field, so that I can fix a report in one pass.
95. As an author, I want a preview that shows exactly the runner's page, so that I know what my team will see.

### The AI

96. As an author, I want to type one sentence like the acceptance case and get the whole report built (parameters, sections, series, charts, text with live figures), so that I don't spend an hour clicking.
97. As an author, I want the AI to list what it assumed ("Period: a parameter, default yesterday"; "HungerStation and QC: two named series"), so that I can check its reading at a glance.
98. As an author, I want the AI to ask only when my words can't be resolved (an ambiguous member, more than 4 series), so that it doesn't slow me down with questions.
99. As an author, I want a figure the model lacks to get "I can't answer that from the analytics model", so that the AI never invents a measure.
100. As an author, I want the AI's report saved as a private draft and opened in the designer, so that I can fix anything by hand.
101. As an author with a report open in the designer, I want "add the cancellation rate as a bar" to change that report, so that the copilot works on what I'm looking at.
102. As an author, I want an AI change to land as one undo step labelled with my request, so that I can take it back in one keystroke.
103. As an author, I want the AI never to save a report I have open, so that saving stays my decision.
104. As an author, I want the AI to edit my hand-built reports too, so that it helps with any report I own.
105. As an author asking the AI to edit someone else's Shared or a Certified report, I want it to offer "Save as my copy" and edit the copy, so that it never changes what isn't mine.
106. As an author, I want the AI to write the report's words in English and Arabic, so that the report works in both languages.
107. As an author, I want the AI's text to hold live figures, never typed numbers, so that its sentences stay right on every run.
108. As an author whose sentence asks to share or schedule, I want the AI to build the report and end with "Share…" and "Schedule…" links, so that those steps stay mine and are two clicks away.
109. As a runner, I want the copilot to keep answering questions without report tools, so that nothing changes for me.
110. As an auditor, I want every AI report call recorded with the words, the definition produced, the outcome, the model and the provider, so that AI-made reports are traceable.
111. As an author, I want the tutorial's last step to show "Or ask the copilot" with the acceptance sentence, so that I learn both ways to build.

### Scheduled email

112. As an author, I want to schedule a report daily, weekly on chosen days, or monthly on a chosen day, at a Riyadh time, so that it arrives when my team starts work.
113. As an author, I want to fix the parameter values a schedule runs with, so that the morning email is always "yesterday".
114. As an author, I want to choose recipients only from analytics users in the report's audience who hold the run grant, so that email never leaks a report.
115. As an author, I want recipients limited to company addresses and 25 per schedule, so that the send stays inside the company and within the relay's limits.
116. As an author, I want to choose the email's language, so that recipients read it in theirs.
117. As a recipient, I want an HTML email with the headline figures, small tables and a "data as of" line, readable in Outlook and Gmail, so that I get the news without opening anything.
118. As a recipient, I want a PDF of the charts attached, so that I see the charts too.
119. As a recipient, I want the email to say "charts unavailable" when the PDF fails, rather than not arriving, so that I still get the figures.
120. As a recipient, I want a link back to the live report with the same values, so that I can dig in.
121. As a recipient of a summary block, I want the email to drop only the summary when it fails its number check, so that the rest still arrives.
122. As an author, I want a missed slot sent once, late, with a late notice, and never twice, so that an outage doesn't flood or skip recipients silently.
123. As an author, I want "Send now" for a schedule, so that I can test it or resend.
124. As an owner, I want my schedule suspended, not deleted, when I lose the run or author grant, and resumed by a curator's handover, so that a role change doesn't destroy the setup.
125. As an owner, I want a send stopped and myself told when a saved parameter value no longer resolves, so that a wrong report never goes out.
126. As an owner, I want recipients who left the audience dropped from that run and listed to me, so that access changes apply to email too.
127. As an owner, a curator or a recipient, I want to open the record of every sent run (revision, values, data as of, trigger, recipients, outcome, summary text), and its HTML and PDF for 90 days, so that "what did we email on Tuesday" can be answered.
128. As an owner, I want to pause, edit and delete a schedule, so that I control what goes out.

## Implementation Decisions

### A. Architecture and the standing constraints

- **ADR 0006 stands.** v2 adds marts, cube views, doors, a worker and screens. It adds no engine, no
  BI tool and no cloud service.
- **SIS.Api resolves every parameter before Cube** (795). Parameters never enter the JWT,
  `COMPILE_CONTEXT` or `FILTER_PARAMS`. The compiled query stays the cache key, so v1's 30 s result
  cache and in-flight coalescing work unchanged for parameter values.
- **One query path.** The screens, the schedule worker, the print render and the AI all ask
  `Analytics/Query` the same way. A report run is a set of panel queries plus the words call
  (section C).

### B. The semantic model (BackOffice `Analytics/`, one tree)

- **The baseline is shipped oms-analytics 1.2.0** (BackOffice 3387 + 3388), not the 745 catalogue.
  Item sales with the merchandising hierarchy, slow-moving stock and customers as hashed aggregates
  are already in it (796).
- **Orders (rank 0, required by the acceptance case):**
  - **New measures:** `cancelled_orders`, `expired_orders`, `cancellation_rate` = Σ cancelled ÷
    Σ orders, and `expiry_rate`, all order-dated (`EntryTime`).
  - **Cancelled** means a terminal close of the order (`C`), or of its delivery (`C`/`X`) once one
    exists. `N` is left out. It is split by the request-close `EntryUser`:
    - `AutoClose` is **expired**;
    - everything else is **cancelled**.
  - It matches the store statistics' `ClosedOrCancelled` predicate (ADR 0081).
  - **New dimension `cancelled_by`:** customer or app, store (`PH`), courier (`Outbox`), platform
    (`BJ_SYSTEM`).
  - **Re-read and freshness:** a 10-day re-read, and days younger than 8 marked "may still rise".
- **`delivery_type`** is a new dimension on orders, delivery and **till**, read from
  `DeliveryHeader.DeliveryDocumentType`:
  - An order with any QC delivery is QC, and an order with no delivery is `(none)`.
  - The labels come from the model. The replica's lookup has no QC row.
  - Till reaches it through **`RetailTrx.DeliveryNo = DeliveryHeader.DeliveryNo`** (owner,
    2026-11-06). 800's chain (`RetailTrx.OrderNo = SdDocumentHeader.OrderNo`, then
    `DocumentNo → DeliveryHeader.RefDocumentNo`) is the fallback only where `DeliveryNo` is empty,
    and the probe counts how often that happens.
- **The channel map** gains the call-centre sources (`COBE`, `COBC`, `CFLO`, …), so about 7.4 k
  orders a week leave `other`.
- **Coupons and promotions (rank 1).**
  - **Now:** till-side coupon value, bonus-buy value and promoted share, from `RetailTrxCondition`
    (dated through `RetailTrx`), `RetailTrxDetailPromo`, `Bonusbuy` (`Master1`) and the order
    lines' `PromotionCoupon*`.
  - **After [The DBA adds the Coupons V2 and payment-discount tables to the replica publication](818-the-dba-adds-the-coupons-v2-and-payment-discount-tables-to-the-replica-publication.md):**
    redemptions net of reversals, the campaign, `RedemptionType` and payment discounts. Those
    measures are declared from the start but stay **unavailable** until 818 closes, the way v1
    treated area 4.
- **Loyalty (rank 2), aggregates only:**
  - **Measures:** points accrued, redeemed and expired, redemption value, enrolments, outstanding
    points and tier mix.
  - **Reads:** the incremental reads a `LoyActivity.ActivityId` range with a 10-day re-read, never
    a date scan.
  - **Expiry** is programme-level.
  - **Reconcile key:** the till's `Points` payment `RequestId`.
  - **Campaign:** shown as `CampaignId` only. There is no `LoyCampaign`.
- **Insurance claims (rank 3), submitted amounts only, on `NAuth`/`NAuthLine`** (`ClaimType` 1 and
  4):
  - **Measures:** claims, submitted payer and patient share (from the lines), rejection counts and
    submission rate.
  - **Keys:** store through `ProviderCode`; channel through `(ProviderCode, InvoiceNo)` → the till.
  - `order_line_approval_rate` is dropped.
- **Sale type: the owner's rule (2026-11-06), replacing 1.2.0's.** 1.2.0 groups `sale_type` from
  `DocumentType` and `SubDocumentType` (ADR 0007 D5). The owner identifies the two major sale types
  **by the account customer** instead: `RetailTrx` is joined to `Customer` on `Client` +
  `CustomerID`, and the rules apply in this order:
  - **`nupco_wasfaty`:** `CustomerID` is one of `0001100135`, `0001100340` or `0001100341`. The ids
    live in a seed (`nupco_wasfaty_customers`), so a new account is a seed change.
  - **`insurance`:** `Customer.IsInsurance = 1`.
  - **`other_account`** (agent, overrulable): any other account customer, for example the SABIC
    credit account.
  - **`retail`:** no `CustomerID`, which is cash or another walk-in sale.

  How the rule is applied:
  - **The join is a `LEFT JOIN`.** The owner's query uses an inner join, which keeps only receipts
    with a customer. Every receipt without one is still a sale and must stay in the mart.
  - `CustomerID` is trimmed and compared under the CI collation.
  - **Channel and sale type are independent.** Insurance and Wasfaty sales also come in online, so
    `online` is no longer a sale type; the channel says how the sale came in.
  - `document_type` and `programme` stay as dimensions, unchanged.
  - A return takes the `CustomerID` of the sale it returns, by the same D6 match as its channel.
  - **`Customer` is read only for `CustomerID` and `IsInsurance`.** Neither the id nor the
    `CustomerName` ever becomes a member.
  - **The fix is a v1 bug, so it doesn't wait for v2.** It ships in a 1.2.x image before 1.2.0
    reaches production (see Gates).
  - The probe checks that `POS.dbo.Customer` and `IsInsurance` are on the replica. It also lists the
    receipts that move between sale types under the new rule, for the owner to check.
- **Fulfilment and slot keeping (owner, 2026-11-06), on the delivery mart and through it on orders
  and till:**
  - **`fulfilment`** (new dimension): pick-up or home delivery, from `DeliveryHeader.DeliveryType`.
    Its name is kept apart from `delivery_type`, which is the delivery *document* type (QC, DL, …).
    If 1.2.0's cube already declares `fct_delivery.delivery_type` (the pick-up/home column), the
    same release renames it to `fulfilment`.
  - **OMS channel and source:** the order type (`RetailTrx.RefDocumentType`) is what the owner calls
    the **OMS channel**, labelled from `SdDocumentType.Description`. The source
    (`RefDocumentSource`) is labelled from `SdDocumentSource.Description`. Both are left joins, as
    in the owner's query.
  - **The delivery document type keeps the model's labels.** The owner's query inner-joins the
    `DeliveryDocumentType` lookup, but 804 found that lookup has no QC row. A left join, labelled
    from the model, keeps QC.
  - **The times:**
    - made ready: `SdDocumentHeaderAction.ReadyTime`, where `DocumentNo` = `DeliveryNo` (left join);
    - the slot: `DeliveryHeader.DeliveryScheduleFromTime` and `DeliveryScheduleToTime`;
    - out for delivery: `OutForDeliveryTime`;
    - delivered: `ActualDeliveryTime`.
  - **The measures:**
    - for home deliveries: `delivered_in_slot`, `delivered_out_of_slot`, `delivered_no_slot`,
      `in_slot_rate` (in slot ÷ (in slot + out of slot)) and `avg_delivery_time_min`;
    - the stage spans: ready to out for delivery, and out for delivery to delivered.

    They follow the glossary's **In slot / Out of slot / No slot** and **Avg delivery time**: the
    slot held when delivered counts, so early is in slot. A pick-up has none of the three.
  - **One rule estate-wide.** The counts must equal the store statistics' In slot figures (BackOffice
    3404). BackOffice reads the same columns that code reads.
  - The existing percentiles stay on the first-ever log times (ADR 0081).
- **The PII bar** names every barred column the surveys found (`LoyMember`, `NAuth` patient fields,
  coupons, staff) and is a dbt schema test. Staging models select by column list only.
- **Named series need no model change.** They are a view-definition feature (section C).
- **Stores by day (`store_day`), the one cross-area view:**
  - **The mart:** `mart_store_day` combines the area marts with `UNION ALL` + `GROUP BY` at
    day × store × channel × delivery type.
  - **Additive figures only:**
    - till: `till_sales`, `till_returns`, gross and net till value;
    - orders: `orders`, `cancelled_orders`, `expired_orders`;
    - delivery: `deliveries`, `deliveries_delivered`;
    - plus the private numerator `order_linked_net_value_sar`.
  - **Ratios declared by BackOffice:** `cancellation_rate`, `delivered_share`,
    `deliveries_per_1000_till_sales` and `net_value_per_order`.
  - **Dates:** each figure keeps its own area's date and says which.
  - **Checks:** a dbt parity test per figure against its own mart.
  - **Freshness:** the oldest among its sources.
  - **Rebuild window:** the same 10 days.
  - Coupons **may** join in a later pull request; v2 does not require it.
- **The model wire grows two optional fields per measure** (agent, overrulable). Both are model
  data, shown by the panel and repeated by the AI:
  - `caveat{en,ar}`, for example "inside OMS only";
  - `mayStillRiseDays`: 8 for the cancellation measures, 30 for claims.
- **Owed rulings, settled here (agent, overrulable; BackOffice confirms in its spec):**
  - **A claim is dated by `ServiceDate`.** It matches the till sale it belongs to. A second time
    dimension, `submitted_date`, is declared for lag questions, and the claims measures carry
    `mayStillRiseDays: 30`.
  - **An e-commerce redemption (`RDEM`, `PointsAmountInCurrency = 0`)** is valued from its matched
    payment where one exists. Otherwise it is valued at points × the programme's points-to-SAR
    rate. BackOffice names the rate's source.
- **Owed facts, checked by the build, not blocking it** (804):
  - which account makes the dominant app `DRCL`, for `cancelled_by = customer`;
  - whether `PH` is production's till user;
  - whether `JAHA` is Jahez.

### C. SIS.Api: the doors (proposed wire; BackOffice owns it once filed)

Every v1 door stays. Changes and additions:

- **`GET Analytics/Access`** → `{ canView, canAuthor, canCurate }`.
  - `canAuthor` is new (794). Curate requires author.
  - Absent or unreachable still means denied.
  - A runner is `canView` without `canAuthor`.
- **The item definitions grow** (one `Analytics/Item` door family, `kind` ∈ `view | board | report`):
  - **A view** gains `series[]`, at most 4. Each series is `{ id, label{en,ar}, filters[] }`, and
    its filters are on the view's own category dimensions.
  - **A board** gains `params[]` and `bindings`, and loses its `filters` and `optOut` for
    parameters. The cross-filter keeps its opt-out. A v1 board is converted **on read** (797
    item 6).
  - **A report** carries `title{en,ar}`, `params[]`, `bindings` and `sections[]`:
    - each section is `{ id, heading{en,ar}, blocks[] }`;
    - a block is a **panel** (an inline view definition plus `from? { viewId, revision }` and the
      computed `sourceChangedSinceCopy`), a **text** block (`{en, ar}` holding live-figure tokens)
      or the **summary** block, at most one.

  The decision-rich shape, as the 798 prototype modelled it:

  ```ts
  type ParamKind = 'period' | 'members' | 'grain' | 'threshold' | 'topN' | 'measure' | 'breakdown'
  type ParamValue =
    | { kind: 'period'; token: PeriodToken }        // or a fixed range
    | { kind: 'members'; values: string[] }        // [] = all
    | { kind: 'grain'; grain: 'day' | 'week' | 'month' }
    | { kind: 'threshold'; op: 'off' | 'gt' | 'gte' | 'lt' | 'lte'; value: number } // display unit
    | { kind: 'topN'; n: number }                  // 1..100
    | { kind: 'measure'; key: string }
    | { kind: 'breakdown'; key: string }
  interface Param {
    name: string            // slug, unique, not tv|refresh|cross|crossFrom; the URL key
    kind: ParamKind
    label: { en: string; ar: string }
    required: boolean       // "viewers can't clear it" — every parameter has a default
    dimension?: string      // members
    pinned?: string[] | null // members: null = open search
    multi?: boolean         // members
    grains?: Grain[]        // grain: the allowed subset
    measure?: string        // threshold
    options?: string[]      // measure | breakdown
    default: ParamValue
  }
  /** param name → panel id → the dimension a members parameter filters there, or true. Absent = not bound. */
  type Bindings = Record<string, Record<string, string | true>>
  type BindReason = 'noTimeAxis' | 'seriesFilters' | 'thresholdShape' | 'topNShape'
                  | 'measureShape' | 'breakdownShape' | 'notInArea'
  ```

- **The audience** is `{ everyone: true }` or `{ roles: string[], users: string[] }` on a Shared
  item.
  - Membership is resolved through authz on every read.
  - **`PUT Analytics/Item/{id}/Audience`** is owner-only, or a curator narrowing it. It writes the
    item's history and is not a definition revision, so it never raises `ANALYTICS-405`.
  - `…/Share` takes an audience. `…/Unshare` is unchanged.
- **`GET Analytics/AudienceCandidates`** with `search` → up to 50 roles (from authz, with
  `removed` for a deleted one) and analytics users `{ id, name, employeeId }`. It feeds the share
  dialog and the recipient picker.
- **`POST Analytics/Item/{id}/Reassign`** with `{ owner }` is curator-only (agent, settling the
  map's "owner who loses the author grant" fog):
  - The new owner must hold author.
  - The item's audience and tier are kept.
  - Suspended schedules resume under the new owner.
  - Without a reassign, an owner who loses author keeps their items as they are. The items keep
    running for their audiences, and nobody can edit them but curators. Their schedules suspend
    (803).
- **`POST Analytics/Query`** input:
  - for a saved item: `{ itemId, revision, panelId, values }`;
  - while editing: `{ definition, params, bindings, panelId, values }`.

  The server applies the bindings. The output gains:
  - `series` as a column role, with one row set per series, merged on the shared axis;
  - `notReached[] { param, reason }`;
  - `fellBack[] { param }` for values outside a declared list;
  - the resolved values.

  Each series is its own Cube `/load` under the 30 s / 10,000-row caps.
- **`POST Analytics/Report/{id}/Words`** with `{ revision, values }` → the filled live figures
  `{ token → formatted value }` and the summary `{ text{lang} } | { unavailable: reason }`.
  - The server runs the report's panels through the same cache.
  - The summary is the one AI call: written from that run's results only, then every number is
    checked against them after rounding to the display format, or it is unavailable.
  - The call is audited under the owner's identity.
- **Schedules:** `GET/POST/PUT/DELETE Analytics/Report/{id}/Schedules[/{sid}]` and
  `POST …/Schedules/{sid}/SendNow`.
  - A schedule is `{ cadence: daily | weekly(days) | monthly(day), time (Riyadh), values, lang,
    recipients[], enabled, suspended?{ reason } }`.
  - The owner, and curators, manage them.
- **Kept runs:**
  - **Doors:** `GET Analytics/Report/{id}/Runs`, then `GET Analytics/ReportRun/{runId}` for the
    record, `…/Html` and `…/Pdf`.
  - **The artefacts:** the HTML and the PDF are served for 90 days, then `410` with the record
    kept.
  - **Who may open them:** the owner, curators and the run's own recipients.
- **The schedule worker** (803):
  - It is an SIS.Api background service behind a config gate, on one always-running instance.
  - It claims one row per schedule × slot with a lease, released on a failed send. It sends a
    missed slot once, late, until the next slot or the day's end, then skips and records it.
  - Before each send it checks the recipients again (run grant, audience, `@al-dawaa.com.sa`, at
    most 25). It uses the owner's rights and stops on `ANALYTICS-412`, telling the owner.
  - It sends through `IEmailService`, extended for attachments and inline CID images.
  - The PDF comes from headless Chromium rendering the print route with a short-lived, read-only
    ticket bound to the owner. When the render fails, the HTML goes alone, saying "charts
    unavailable".
  - At most **2 report runs** go at once, inside v1's concurrency cap of 8 (agent, provisional on
    750).
- **Refusal codes.** v1's 401–410 are unchanged, plus:

| Code | Meaning | What the web does |
|---|---|---|
| `ANALYTICS-411` | an invalid declaration at save: a reserved, duplicate or non-slug name, a binding that doesn't fit, an option breaking a shape rule, a bad default, a series problem (more than 4, a duplicate label, a foreign dimension), a live figure naming a missing panel or a non-single value, or AI text holding a bare number | lists each problem in the save refusal; each one takes the author to its field |
| `ANALYTICS-412` | an invalid value at run: outside the type or the list, an unknown member, a non-number threshold, or N out of range | names the parameter in the strip; a schedule send stops and tells the owner |
| `ANALYTICS-413` | not shared with you | the "not shared with you" page, naming the owner; no title or data |
| `ANALYTICS-414` | an invalid recipient: not in the audience, no run grant, not a company address, or over 25 | names each recipient in the schedule editor |
| `ANALYTICS-415` | needs the author grant | hides the action next time; the runner never sees it in normal use |

- **Audit:** every v1 audit plus each audience change, reassign, schedule change, send (with its
  outcome), kept-run open, words call and AI report call.

### D. The AI (734's one catalogue, `panel` surface only; MCP stays read-only)

- **`create_view`** may write named series.
- **`create_report`** takes a whole report definition (section C's shape, all words in English and
  Arabic). It writes a **Personal** report at revision 1 and returns `{ id, revision }`. It creates
  no Personal views.
- **`edit_report`** takes `{ reportId, baseRevision | draft, definition }`, a full replace:
  - With a **report in context** from the designer, it returns the validated definition **unsaved**.
  - Otherwise it saves a new revision. A stale `baseRevision` is `ANALYTICS-405`.
- **Both run the designer's validator and its pre-fill rule.** A refusal goes back to the model so
  it can correct itself in the same answer.
- **The demo's `build_report`, `update_report` and `get_report` are retired.** Its frozen copilot
  report kind is not migrated.
- **The rulebook, which goes into the prompt and is tested by D14:**
  - a period in the words sets the ready-made period parameter's default;
  - a fixed mention is a filter, and "I pick" is a parameter;
  - comparing values from **two dimensions** makes named series, at most 4;
  - comparing values from **one dimension** makes a filtered breakdown;
  - figures from two areas in one chart use `store_day` when every measure is declared there, and
    otherwise go as panels side by side;
  - "top 10" is fixed, and "top N I choose" is a parameter;
  - text holds live figures only;
  - the summary block is added only when the request asks for findings or a summary;
  - the words are written in both languages.
- **No plan step (owner).** The answer lists the assumptions, one line each. The AI asks only for
  an ambiguous or unknown member, or for more than 4 series. A figure outside the model gets
  `cannot-answer`.
- **The report in context (owner):**
  - The Ask body gains an optional `reportContext { reportId, revision, draft }`, sent while a
    report is open in the designer.
  - The AI may edit the user's own Personal or Shared report. For a Certified or someone else's
    Shared report, it offers Save as my copy.
- **It never shares, certifies or schedules.** When the words ask for those, the answer ends with
  "Share…" and "Schedule…" links to the report's dialogs.
- **The tools are offered only with `canAuthor`.** A runner's copilot is unchanged.
- **The D10 answer** gains `reportRefs[] { id, revision, title{en,ar} }` and an optional
  `reportEdit { reportId, definition, note{en,ar} }`. Both read as empty when missing. The new trace
  labels are "Building a report" and "Editing the report". The 10-question conversation cap stands.

### E. The web half: the `analytics` area grows

- **The feature stays `boards`** (i18n namespace `boards`, `en` and `ar`). The report screens live
  beside the board screens, because they share the parameter strip, the panel renderer, the tiers
  and the item store. There is one `api` module for every Analytics door. No new feature folder is
  added.
- **Routes:**
  - `/analytics/report/:id`, the runner's page;
  - `/analytics/report/:id/edit`, the designer;
  - `/analytics/new?kind=report`;
  - the kept print route `/analytics/print/report/:id`, now taking parameter values in its query
    string;
  - `/analytics/report/:id/runs`, the kept-run list.

  The CTO demo's report page and its frozen-document model are replaced, not kept beside.
- **Access:** the probe reads `canAuthor`. A runner gets no builder routes (a direct URL shows the
  no-access state), no edit actions, no copy and no AI ask box.
- **The parameter strip replaces v1's filter strip on boards and reports.** It is one component
  with one control per kind, plus "Reset to defaults". In design mode it adds a ⚙ on each parameter
  and "+ Parameter". The permalink module is extended:
  - each parameter's name is its query key;
  - several members repeat the key;
  - `name=` means cleared;
  - a threshold is written `name=gt:5`;
  - `tv`, `refresh`, `cross` and `crossFrom` are reserved.

  v1's six keys keep their meaning. A `fellBack` answer shows a one-line notice.
- **The binding module** (pure, mirrored from the server's rules for instant feedback; the server
  stays the authority):
  - `canBind(param, panel)` → ok, or a `BindReason`;
  - the pre-fill;
  - the save-time `validate` → the list of `ANALYTICS-411`-shaped problems;
  - the "not filtered by …" lines: a runner sees them only for parameters moved off their defaults,
    and the author sees all of them.
- **Named series in `core/charts`:** series take the colour role in slot order, with no total
  across them. Clicking a legend entry highlights. The export carries a `series` column. A KPI tile
  shows one figure per series.
  - **The SeriesChart fix:** multi-series bars draw in one colour today, because a row's own `fill`
    beats the `<Bar fill>` prop. The fix sets the row fill only for a single series. It is the
    first web ticket and needs no other part of v2.
- **The designer (798's variant D):**
  - **The outline** sits on the start side: the parameters, then the section tree. It is sticky,
    every row can be selected, and sections and blocks can be dragged.
  - **The page** sits in the middle:
    - the editable title and the strip;
    - a toolbar on each section heading and block: grip, edit, up, down, remove;
    - "Add to this section": a chart or table, a saved view to copy, text, or the AI summary.
  - **The inspector** sits on the end side. It is sticky, never a modal, and holds the parameter,
    panel, text and section editors. The parameter inspector includes the parameters × panels
    binding overview.
  - **Declaring a parameter** goes in this order:
    1. the kind;
    2. the name, checked live;
    3. the label in English and Arabic;
    4. the fields for that kind;
    5. the default, set with the viewer's own control;
    6. "Applies to", pre-filled, with reasons for each panel that can't take it.
  - **The panel editor:**
    - provenance ("copied from … r n", and "changed since");
    - the area, measures, axis and chart type, with only the fitting types offered (v1's shape
      rules);
    - named series, up to 4;
    - the panel's parameter list.
  - **The text editor** has English and Arabic fields, "Insert a live figure" (choose a panel and
    one of its single values), and a preview. Figures show as chips, never as raw tokens.
- **The designer history** (a pure reducer, from the 798 prototype):
  - `{ past, present, future }`, capped at 100 steps;
  - typing in one field is one step while the same key is edited within 1.5 s;
  - Ctrl+Z / Ctrl+Y (and Ctrl+Shift+Z), plus buttons;
  - "Removed … · Undo" for every removal, and no confirm dialogs;
  - a drop is one step;
  - an AI `reportEdit` is one step, labelled with the request;
  - a save clears the unsaved marker but not the history; revisions and revert take over across
    sessions.
- **Drag and drop:** native HTML5. The grip is the draggable and the whole item is the drag image.
  The top or bottom half of the target picks the side, and a drop line shows where the item will
  land. Blocks may move across sections. Keyboard up and down covers the same moves.
- **The tutorial:**
  - It is one fixed checklist that builds the acceptance case from a blank report.
  - Each step ticks itself from the report's state.
  - "Load the finished report" is the way out.
  - It sits at the top of the inspector, opened by a "Tutorial" action in the designer.
  - Its last step is "Or ask the copilot".
- **The runner's page:**
  - the title, an audience chip, the strip and Reset;
  - the sections, rendered with v1's panel frame: loading feedback, freshness, panel actions and
    drill;
  - live figures as isolated machine values;
  - the summary or "summary unavailable";
  - the caveats and "may still rise" marks from the model;
  - export and a copied link carrying the values.

  There is no edit control, no cross-filter and no TV mode on a report.
- **The share dialog:** "Everyone", or roles plus users picked through `AudienceCandidates`. A
  removed role is marked. It saves through the Audience door, and a curator's narrowing uses the
  same dialog.
- **The schedule editor:** a dialog on the report:
  - cadence and Riyadh time;
  - parameter values, set with the strip's controls;
  - language;
  - recipients from `AudienceCandidates`, filtered to the audience, with `ANALYTICS-414` named per
    person;
  - enable or pause, Send now, and the suspended state with its reason.
- **The kept-run list:** the date, trigger, values, recipients and outcome, with HTML and PDF links
  while they are kept.
- **The copilot (`features/copilot`):**
  - It renders `reportRefs` as "Open in designer", and the assumptions as a list.
  - It sends `reportContext` when one is published.
  - It hands a `reportEdit` back to the designer.
- **The report-in-context bridge.** The copilot never imports the analytics feature, and the
  analytics feature never imports the copilot, so the bridge is a small **core** store:
  - the open designer publishes `{ reportId, revision, draft }`;
  - the copilot reads it when asking;
  - the copilot posts a `reportEdit`, and the designer applies it as one history step;
  - the designer clears the store when it closes.
- **Save as report** on a board copies its view panels into one section as inline blocks, its text
  panels into text blocks and its section panels into headings, and copies its parameters and
  bindings.
- **i18n and bidi:**
  - Every label is a `boards` key in `en` and `ar`.
  - Model labels, series labels, headings and text are data, isolated by kind.
  - A live figure is a machine value, isolated whole (`Ltr`).
  - Counts and ranges use `formatCount` and `formatRange`.
  - `fsi()` is used in string-only sinks (titles, toasts, `t()` interpolation), never in grids or
    exports.
  - The email body and the PDF follow the same rule.
- **Controls:** every control is a `core/ui` control. The prototype needed no hand-written
  `<button>`, `<input>` or `<select>`, and the control ratchet's baseline for `boards` does not
  grow.

### F. Settled fog (agent, overrulable)

- **Certified items** stay visible to every analytics user. Limiting a Certified item to an audience
  is out of v2.
- **Saved parameter sets** ("my store list") are out. The permalink is the saved set.
- **Teaching:** v2 has one fixed tutorial. A "show me how this was built" replay per Certified
  report is out.
- **Load:**
  - A panel with series costs one query per series, up to 4.
  - `store_day` rebuilds a 10-day window.
  - The new areas' daily reads are 5–25 s on the replica (800). Loyalty avoids its 56 s date scan
    by reading an id range.
  - There are no Cube pre-aggregations. Add one only for a measured query that misses its budget.
  - Every cap stays provisional on 750.
- **Feedback from v1 in use** may reorder the new areas' slices (coupons, loyalty, claims). It never
  changes the orders slice, which the acceptance case needs.

## Testing Decisions

- **Test only external behaviour.**
  - **On the web,** assert what a user sees and what the server is asked: the strip's values, the
    URL, panel reach notices, refusal messages, history steps and the rendered order. Never assert
    a component's internals.
  - **On the server,** assert what a client gets: rows per series, codes, the store's state, sent
    mail and the kept records.
- **Web seam 1: pure modules (vitest, in-memory).** This is the existing tier, with the same prior
  art as v1 (the analytics feature's `effective-query`, `permalink`, `editor`, `item-tier` and
  `item-save` tests, and the copilot's `answer` and `trace` tests). New or extended:
  - **Bindings:**
    - `canBind` over the case table: each kind against each panel shape, the series-filter rule
      and the area rule;
    - the pre-fill;
    - `validate` → every `ANALYTICS-411` shape (name slug, reserved, duplicate, binding, series,
      live figure);
    - the "not filtered by …" set for the author and for a runner.
  - **The v1 board conversion:** filters become defaults, and the implicit rule minus `optOut`
    becomes the same bindings the server computes.
  - **The permalink with parameters:**
    - every kind survives encode → decode;
    - repeated keys, `name=` and `gt:5`;
    - reserved names;
    - every v1 permalink decodes to the same effective query as before.
  - **The effective query:** a parameter value changes the key only for the panels it is bound
    to.
  - **The designer history reducer:**
    - apply, undo and redo;
    - the 100-step cap;
    - typing coalescing by key within 1.5 s;
    - a removal's undo restoring the exact position;
    - a drop as one step;
    - an AI edit as one labelled step;
    - redo cleared by a new edit.
  - **The reorder operations:** move a block within and across sections, move a section, and the
    top-half / bottom-half side rule, all as pure functions of the report.
  - **Live figures:** token parsing, `figuresOf(panel)`, the missing or non-single refusal, and the
    chip and text round-trip.
  - **Named series:**
    - the merge of per-series rows on the shared axis;
    - slot order;
    - no cross-series total;
    - the export's `series` column;
    - the SeriesChart colour rule as a pure "row fill only for one series" function.
  - **Tier and actions with grants:** grant × tier × owner × curator × audience → run, edit, copy,
    share, reassign, schedule, AI.
  - **The wire:**
    - 411–415 map to their i18n keys, with an unknown code falling back to the server message;
    - absent `series`, `notReached`, `fellBack`, `reportRefs` and `reportEdit` read as empty.
  - **The copilot answer:** `reportRefs`, `reportEdit`, the assumptions list and the two trace
    labels.
- **Web seam 2: one Playwright drive against stubbed envelopes,** grown from the 798 prototype's
  drive (165 checks at its last run) and folded into the existing `analytics-drive` stubs. It
  covers:
  - the runner's page and the absence of every edit control;
  - each parameter kind's control;
  - Reset, and a link carrying values;
  - the fallback notice;
  - "not filtered by";
  - each refusal code;
  - the designer:
    - declaring a parameter end to end;
    - the panel editor with 4 series;
    - text with a live figure;
    - the summary, written and unavailable;
  - undo and redo by keys and buttons;
  - drag and drop of sections and blocks (in a viewport tall enough that the drag never scrolls,
    because Chromium drops a drag that scrolls);
  - the tutorial ticking to done;
  - the share dialog and `ANALYTICS-413`;
  - the schedule editor with `ANALYTICS-414`;
  - the kept-run list;
  - Save as report from a board;
  - the copilot: create, then an in-designer edit landing as one undo step;
  - **the acceptance case end to end:** the owner's sentence → a stubbed `create_report` → the
    designer → share → schedule → the runner's page;
  - en, ar and dark screenshots.

  The `copilot-drive` gains the `reportRefs` and `reportEdit` steps.
- **No new runner.** React Testing Library is still not installed (spec 083's ruling, confirmed by
  the owner for this spec). Components are thin renderers over the pure modules and are verified by
  the drive plus `typecheck`.
- **A live walk on staging** closes the web half, after the server asks land, as v1's 784 does for
  v1.
- **The server, owned by BackOffice:**
  - **dbt:** the PII schema test over every new staging model; `store_day` parity per figure; the
    cancellation predicate's parity with `ClosedOrCancelled`; the channel-map fix; and the
    loyalty id-range incremental.
  - **The compiler:** parameters → `/load` golden tests per kind, series → N queries, and
    `notReached` and `fellBack`. Validator tests use the **same case table** as the web's binding
    module.
  - **The store:** the audience resolved through authz (including a removed role), 413, the
    reassign, the v1 board conversion and kept-run access.
  - **The worker:** the slot claim and lease, catch-up once and never twice, a suspended owner, a
    412 stop, recipients re-checked, the render failure path, and the 90-day artefact expiry.
  - **The summary:** the number check passing and failing, with the block dropped and the run
    going on.
  - **The AI:** D14 gains whole-report cases, with the acceptance sentence first and 798's sample
    report as the expected answer.
    - **Report cases pass on structure:** the period default, the parameters and their kinds, the
      series and their filters, the measures and breakdowns per panel, chart types fitting the
      shape, no typed number in text, and no share, certify or schedule attempted.
    - **Edit cases** pass when only the asked part changes.
    - Q16–Q31 (796) join as query cases.
    - All cases run against every connector before a prompt, model, tool or model-connector change
      ships.

## Out of Scope

- **Row-level security** for regional or store managers. v2 stays HQ only.
- **A SQL editor, user-made joins, pivot tables and a banded or free-form report designer** (not
  WebI or Stimulsoft).
- **Metabase or any BI tool's own UI,** and cloud warehouses or cloud BI.
- **Threshold alerts** ("tell me when the cancellation rate passes 5 %").
- **Linked filters** (picking a city narrows the store list), and **top N per series over time**.
- **Margin, cost and profit**, and **SAP / IDoc health** as an analytics area.
- **Platform-side cancels** (`DhOrderHeader`, `DlvOrderHeader`, not on the replica). Cancellation
  counts inside OMS only, with a caveat.
- **Approved or paid insurance amounts,** prior-authorisation outcomes, and coupons issued against
  redeemed. They are revisited only if HQ asks once v2 runs.
- **Certified items limited to an audience; saved parameter sets; a per-report "how it was built"
  replay.**
- **The AI sharing, certifying or scheduling; AI report tools on MCP;** and an AI plan step.
- **A report's cross-filter, TV mode, auto-refresh and grid layout.**
- **Rotating the credentials committed in BackOffice source** (found by 803). It is a BackOffice
  security fix.
- **Migrating the CTO demo's copilot reports.**

## Further Notes

- **Gates:**
  - **v2's build starts after v1 runs on real data**
    ([The analytics screens call the real doors on staging](784-the-analytics-screens-call-the-real-doors-on-staging.md)).
  - **Coupon redemption measures** wait on
    [The DBA adds the Coupons V2 and payment-discount tables to the replica publication](818-the-dba-adds-the-coupons-v2-and-payment-discount-tables-to-the-replica-publication.md).
    They are declared unavailable until then, and nothing else waits on it.
  - **The SeriesChart fix** waits on nothing.
  - **The sale-type fix waits on nothing and goes first.** The owner's customer-based rule is a v1
    correction, shipped as a 1.2.x image. Production gets that image instead of 1.2.0, so no wrong
    sale-type figures ever reach HQ.
- **Provisional values,** each with its trigger: v1's caps and the concurrency cap of 8 (750); 2
  concurrent report runs; 25 recipients (the tenant's real Workspace limits); 90-day artefacts;
  `mayStillRiseDays` of 8 and 30.
- **Open asks for BackOffice and infra** (from 803):
  - the tenant's Workspace send limits and attachment cap;
  - whether report mail gets its own sender mailbox;
  - Chromium on the production IIS host, and which instance runs the worker;
  - SMTP egress from that instance;
  - which freshness signal a run checks before sending;
  - the source of the points-to-SAR rate.
- **BackOffice asks** (not filed from here; BackOffice is read-only from this map). The suggested
  split:
  - **First, ahead of v2: the 1.2.x sale-type fix** (the owner's customer rule). It is a v1 change
    with its own image.
  1. **the orders slice:**
     - cancellation, expiry and `cancelled_by`;
     - `delivery_type` on orders, delivery and till, with till joined by `DeliveryNo`;
     - `fulfilment` and the slot-keeping measures;
     - the channel-map fix;
     - `caveat` and `mayStillRiseDays` on the model wire;
  2. **`store_day`:** the mart, the parity tests and the view;
  3. **grants and audiences:** `canAuthor`, the Audience door, `AudienceCandidates`, 413, 415 and
     Reassign;
  4. **parameters:**
     - the definitions;
     - bindings and the v1 board conversion;
     - the compiler for each kind, including the measure filter;
     - `notReached` and `fellBack`;
     - 411 and 412;
  5. **named series:** the view shape, one query per series, and the merge;
  6. **the report kind:** sections, inline panels with provenance, and live figures;
  7. **the Words door and the summary:** the number check and the audit;
  8. **the copilot:** `create_report`, `edit_report`, `reportContext`, `reportRefs`, `reportEdit`,
     the rulebook prompt and the D14 report cases;
  9. **the schedule worker:**
     - `IEmailService` attachments;
     - the Chromium render ticket;
     - the schedule doors;
     - 414;
     - kept runs and their 90-day expiry;
  10. **coupons (till-side), loyalty and claims areas,** each its own slice, ranked as in 796;
  11. **the coupon redemption measures, after 818.**
- **Web tickets** (for `/to-tickets`), in a suggested order:
  1. **the SeriesChart fix,** with no dependency on the rest of v2;
  2. the `canAuthor` probe, and the runner's view of the existing screens;
  3. the parameter strip and the permalink with parameters, replacing the filter strip on boards,
     including the v1 conversion;
  4. binding in the board editor: pre-fill, reasons, the overview and the 411 list;
  5. named series in the chart editor and `core/charts`;
  6. the audience share dialog and 413;
  7. the report kind: the runner's page, with live figures, the summary and the print route with
     values;
  8. the report designer's frame, history and drag and drop;
  9. the designer's editors: parameter, panel, text and section;
  10. Save as report and copy-from-view provenance;
  11. the tutorial;
  12. the copilot: `reportRefs`, `reportEdit`, the core report-in-context bridge, and the
      assumptions list;
  13. the schedule editor and the kept-run list;
  14. the new areas' labels, caveats and "may still rise" marks as they land;
  15. the live walk against staging.
- **Evidence:**
  - **The prototype:** branch `prototype/793-parameters` (worktree `oms-react-proto798`), at
    `/analytics/prototype/report`. `?variant=D` is the chosen designer; A, B and C are the
    rejected ones.
  - **Scenarios:** design, tutorial, declare, panel, text, share, refused, run, run-fallback and
    not-shared.
  - **Shots:** `.issues/assets/798-shots/`.
  - **Drive:** `tools/report-proto-798-drive.mjs`.
- **The acceptance case is the spec's test.** The owner's sentence, typed into the copilot, gives
  798's sample report:
  - the period defaulting to yesterday;
  - net value by channel;
  - HungerStation against QC as two named series, for value and for the cancellation rate, the
    latter with the "inside OMS only" caveat;
  - a Stores by day table;
  - text with live figures.

  The author then shares it with the team's roles and schedules it daily. A runner re-runs it for
  last week, and a recipient gets the email.
