---
type: spec
status: ready
map: 741
---

# 766 — HQ self-service analytics v1: native boards and AI-made views over one governed model

Settled for [Self-service analytics with AI](741-self-service-analytics-with-ai-map.md) on
2026-11-05. The stack is recorded in
[ADR 0006](../docs/adr/0006-analytics-is-native-screens-over-cube-and-dbt-marts.md): dbt marts in
`POS_Analytics`, Cube Core as the only engine, SIS.Api as the gate and the store, and oms-react
drawing everything with Recharts. **Metabase is not part of v1 in any role** (owner ruling,
2026-11-05).

This one spec carries **both halves**. The web half is built here. The server half is a set of
**BackOffice asks** (see Further Notes): BackOffice is read-only from this map, so they are not
filed from here. Each server shape below is **proposed**, and the BackOffice spec that takes it
becomes its normative owner. ⚠ **Drift rule:** a `400` on a web ticket's first live call is a
drift report. Correct the BackOffice spec first, then this transcription, never the transcription
alone.

Sources (the detail lives in each; this spec does not restate the reasoning):
- **The semantic model:** [745](745-which-subject-areas-measures-and-questions-does-v1-answer.md) and
  [its catalogue](../docs/research/741-v1-semantic-model.md);
- **The AI path:** [746](746-how-does-the-ai-generate-queries-and-views-within-spec-734s-tool-catalogue-and-mcp.md);
- **Native exploring:** [747](747-do-users-explore-inside-oms-react-or-inside-the-bi-tool.md) and
  [754](754-does-embedded-superset-beat-native-over-metabase-oss-for-hq-exploring.md);
- **Authoring, tiers and boards:** [755](755-what-can-an-hq-user-author-natively-and-who-may-edit-which-board.md);
- **The marts:** [748](748-what-builds-the-marts-views-on-the-replica-dbt-into-a-sibling-database-or-a-copy-to-a-columnar-store.md);
- **The hosting:** [749](749-it-approves-the-on-prem-hosts-and-service-logins-for-the-analytics-stack.md);
- **The spikes:** [756](756-a-local-spike-proves-cube-core-answers-a-governed-load-over-sql-server.md)
  (Cube) and [757](757-a-local-spike-proves-dbt-sqlserver-builds-incremental-marts-into-a-sibling-database.md)
  (dbt);
- **Charts and loading feedback:** [the Recharts research](../docs/research/741-recharts-for-native-charts.md).

Glossary: `CONTEXT.md` defines *analytics view*, *board*, *tier* (Personal, Shared, Certified)
and *curator*. Copy never says "saved view", "card", "question" or "dashboard".

## Problem Statement

People at HQ ask the same questions every week:
- how much went through our tills by city;
- which channel's orders grew;
- how fast deliveries reach the customer;
- how often callouts are taken.

Today each answer is a request to a developer. Someone runs SQL against the POS replica,
copies the result into a spreadsheet, and the numbers drift from the ones the copilot or the
dispatch scorecard show. Nobody at HQ can build a chart, keep it or share it. No board refreshes
on its own. Nothing can be asked in plain words and kept as a chart.

The replica must not carry this load. It replicates the production till and order data, so ad-hoc
scans over `RetailTrx` (about 465M rows) or `SdDocumentLog` would compete with replication.
Nothing analytical may ever be written into `POS`.

## Solution

A new **Analytics** area in oms-react, at `/analytics`, open to holders of a new screen grant.

- **Boards** show panels of charts over a curated semantic model: four subject areas, about
  thirty measures and a fixed set of dimensions.
  - Users filter a board by period, city, region, store, channel and country.
  - Clicking a mark cross-filters the other panels.
  - A user can drill into another breakdown, or hand off to the OMS screen that shows the
    underlying records.
  - Each panel offers fullscreen, a table view, downloads and a permalink.
- **The panels show work at once.** Each panel redraws as its own answer arrives. The old chart
  stays visible, dimmed, until then. A board can refresh itself and run full-screen on a wall
  screen.
- **Users author within the model.** Anyone with the grant can build an analytics view or a board,
  keep it Personal and share it. **Curators** certify the boards everyone should trust. Every save
  is a revision that can be reverted. Editing something that isn't yours makes your own copy and
  never changes the original.
- **The AI builds views.** In the copilot panel, or the ask box on `/analytics`, a user asks "orders
  by channel per day this week versus last". The AI reads the model, runs the query, answers with
  the real numbers and can keep the answer as a Personal analytics view, which opens natively at
  its own route.
- **Behind the screens,** dbt builds marts into `POS_Analytics` every 15 minutes, Cube answers every
  query from those marts, and SIS.Api checks, caps, caches and audits each one. The replica sees
  only dbt's bounded, scheduled reads.

## User Stories

**Access and finding things**

1. As an HQ user with the analytics grant, I want an Analytics item in the menu, so that I can reach boards without asking anyone for a link.
2. As a user without the grant, I want the Analytics item and its routes to be absent, so that I am never shown a screen that refuses me.
3. As an HQ user, I want the analytics home to list Certified boards first, then Shared ones, then my own, so that the trusted figures are the first thing I see.
4. As an HQ user, I want to search boards and analytics views by title in either language, so that I find one in a long list.
5. As an HQ user, I want each item on the home to show its tier, owner and when it last changed, so that I know whose numbers I am looking at.
6. As a curator, I want a Certified badge to show on every certified item wherever it appears, so that users can tell curated figures from personal experiments.

**Reading a board**

7. As an HQ user, I want a board laid out as a grid of panels, so that related figures sit together.
8. As an HQ user, I want KPI tiles with the change against the previous period (▲▼ %), so that I see the headline and its direction at once.
9. As an HQ user, I want line, stacked area, bar (vertical, horizontal, stacked, grouped), donut, table with cell bars, heatmap and combo panels, so that each question gets the chart that fits its shape.
10. As an HQ user, I want each channel to keep the same colour on every chart and after every filter, so that I never misread HungerStation as another channel.
11. As an HQ user, I want a breakdown with more members than the palette holds to show the top members plus "Other", so that a chart never invents a new colour.
12. As an HQ user, I want a tooltip on every mark, with the value, its label and the period, so that I can read exact figures without a table.
13. As an HQ user, I want each panel's title to say what it measures in plain words, generated from the model when nobody wrote one, so that I never see a raw key.
14. As an HQ user, I want till value always worded "value through our tills", never revenue, so that nobody quotes it as income.
15. As an HQ user, I want each panel to show "fetched N ago" and "data as of HH:MM", so that I know how fresh the figure is and never mistake it for live data.
16. As an HQ user, I want a visible "data is behind" warning when the marts have not refreshed for too long, so that I don't act on stale numbers.
17. As an HQ user, I want an empty panel to say there is no data for these filters, so that I can tell nothing happened from something broke.
18. As an HQ user, I want a panel that failed to load to say so and offer a retry, while the other panels keep working, so that one bad query never blanks the board.
19. As an HQ user, I want a panel whose result was cut at the row cap to say it was cut, so that I don't treat a partial table as complete.

**Filters, cross-filter and drill**

20. As an HQ user, I want board filters for period, city, region, store, channel and country in one strip above the panels, so that one change re-asks every panel.
21. As an HQ user, I want relative periods (today, yesterday, this week, last week, last 7, 28 or 30 days, this month, last month, year to date) and a fixed range, so that a saved board keeps meaning "last 30 days".
22. As an HQ user, I want weeks to start on Sunday, so that the figures match the business week.
23. As an HQ user, I want to compare a period with the one before it, so that I can see growth without doing the arithmetic.
24. As an HQ user, I want clicking a bar, slice or row to filter every other panel on that member, and clicking it again to clear the filter, so that I can follow one store or channel across the board.
25. As a board author, I want any panel to opt out of any board filter or of the cross-filter, so that a fixed reference panel stays fixed.
26. As an HQ user, I want to drill from a point into another breakdown, with a breadcrumb back, so that I can find what is behind a spike.
27. As an HQ user, I want to drill from a store, city or callout to the matching OMS screen, already filtered, so that I can see the records behind a figure under that screen's own rules.
28. As an HQ user, I want no drill to show customer rows inside analytics, so that personal data never appears on an analytics surface.
29. As an HQ user, I want a measure with no detail screen (till sales) to offer no detail drill, so that I never follow a dead link.

**Feedback while it works**

30. As an HQ user, I want the filter strip to show "Updating… n of N panels" with a progress bar the moment I change a filter, so that I know my click was taken.
31. As an HQ user, I want each busy panel to keep its previous chart, dimmed, with a spinner, a bar along its top edge and an "Updating…" label, so that the board never goes blank while it works.
32. As an HQ user, I want each panel to redraw the moment its own answer arrives, so that I am not held back by the slowest panel.
33. As an HQ user, I want a filter I changed again before the answers came back to win over the older one, so that the board never shows answers to a question I no longer asked.
34. As an HQ user, I want a cross-filter click to re-ask only the panels it affects, so that the panel I clicked stays usable.
35. As a screen-reader user, I want busy panels marked busy and the strip's progress announced politely, so that I know the board is working.

**Panel actions**

36. As an HQ user, I want to open any panel full-screen, so that I can read a dense chart.
37. As an HQ user, I want to see any panel as a table, so that I can read exact values or use assistive technology.
38. As an HQ user, I want to download a panel as CSV, xlsx or PNG, so that I can put it in a report.
39. As an HQ user, I want a permalink that opens the board with my current filters, so that a colleague sees exactly what I see.
40. As an HQ user, I want to refresh a single panel on demand, so that I can check one figure without reloading the board.

**Authoring an analytics view**

41. As an HQ user, I want to build a new analytics view by choosing measures, breakdowns, filters, sort and top N from the model only, so that I can answer my own question without SQL.
42. As an HQ user, I want only the chart types that fit my choice offered, so that I never put a rate in a donut or stack a percentile.
43. As an HQ user, I want to choose the number format (auto, integer, decimal, %, SAR, minutes) and the legend position, so that the chart reads the way my audience expects.
44. As an HQ user, I want to choose series colours only from the DMSCO chart tokens, so that my chart works in dark mode and stays consistent with the rest.
45. As an HQ user, I want to give a title and subtitle in English and Arabic, so that the view reads properly in both languages.
46. As an HQ user, I want a percentile measure over more than 92 days refused with a reason, so that I know why and can shorten the window.
47. As an HQ user, I want subject areas that are not available yet (callouts and donor requests, before their data arrives) shown as unavailable with a reason, so that I don't build on data that isn't there.
48. As an HQ user, I want saving my own item to save it in place, so that I can iterate.
49. As an HQ user, I want editing an item I may not edit to save as my own copy, recording where it came from, so that I never change someone else's work.
50. As an HQ user, I want an explicit "Save as copy" on Shared and Certified items, so that I can start from a trusted view.
51. As an HQ user, I want a save that clashes with someone else's newer save refused, and I want to be offered a copy instead, so that neither of us silently loses work.

**Authoring a board**

52. As an HQ user, I want to drag and resize panels on a 12-column grid that mirrors under Arabic, so that I can lay out a board.
53. As an HQ user, I want each chart type to have a minimum size, so that no panel shrinks into nonsense.
54. As an HQ user, I want to add a panel from an analytics view (mine, Shared or Certified), linked by reference, or build a new one on the board, so that a fixed view updates every board that shows it.
55. As an HQ user, I want text and section-header panels, so that a board can explain itself.
56. As an HQ user, I want a board to keep working with a "view removed" panel when a view it shows is deleted, so that a deletion never breaks it.
57. As a board author, I want to save a default auto-refresh interval with the board, so that a wall screen refreshes without anyone touching it.

**Tiers, curation and history**

58. As an owner, I want to share my item with every analytics user in one click and take it back again, so that sharing is cheap and reversible.
59. As a curator, I want to certify a Personal or Shared item, which freezes a certified copy while the original stays its author's, so that the trusted version cannot drift.
60. As a curator, I want to certify a later revision of the source into the certified copy as one new revision, so that improvements reach the certified copy deliberately.
61. As a curator, I want to un-certify or delete a Certified item, so that a wrong figure can be withdrawn.
62. As an owner, I want to delete my own items, so that my list stays clean.
63. As anyone who may edit an item, I want its history (who, when) for the last 20 revisions and a revert that is itself a new revision, so that a bad save is never final.
64. As the owner of a copy, I want to see "the original changed since you copied it", so that I know my copy may be out of date.
65. As a viewer, I want to be unable to certify, so that only curators decide what is trusted.

**Auto-refresh and wall screens**

66. As an HQ user, I want a refresh picker on a board (Off, 30 s, 1 min, 5 min, 15 min), changeable for my session without editing the board, so that I control what my own screen does.
67. As an HQ user, I want refresh to pause while the tab is hidden and catch up when I return, so that idle tabs cost nothing.
68. As an ops-room lead, I want a TV mode that hides the app shell, fills the screen with panels and shows the filters as a read-only strip, and that I leave with Esc, so that a board works on a wall screen.
69. As an ops-room lead, I want a permalink that opens straight into TV mode with refresh on, so that the wall screen is one link.
70. As the business, I want ten screens on the same Certified board to cost about one query per interval, not ten, so that a wall of screens never loads the server.

**Asking the AI**

71. As an HQ user, I want to ask an analytics question in plain words in the copilot panel and get an answer with the real numbers, so that I don't need to build a chart for a one-off question.
72. As an HQ user, I want an ask box on `/analytics` that hands my question to the same copilot, so that I can ask where I am looking.
73. As an HQ user, I want the AI to keep its answer as an analytics view when I ask, and to show an "Open view" link, so that I can open and keep the chart.
74. As an HQ user, I want a view the AI makes to be Personal to me, so that nothing the AI makes is shown to others until a person shares it.
75. As an HQ user, I want the AI to pick a chart type that fits the data shape, so that its views read well.
76. As an HQ user, I want the AI's chart and measure names in Arabic when I work in Arabic, so that an AI view is not stuck in English.
77. As an HQ user, I want the AI to say "I can't answer that from the analytics model" for questions outside it (per customer, per staff member, revenue, product mix, forecasts), so that it never invents a figure.
78. As an HQ user, I want the copilot's "How I got this" trace to name the analytics steps in plain words, so that I can see what it queried.
79. As an MCP client user, I want to read the model and run analytics queries through MCP, so that my own assistant can answer from the same figures.
80. As the business, I want MCP unable to create views, so that MCP stays strictly read-only.

**Governance, safety and trust**

81. As the business, I want every analytics query and every AI view creation audited with the acting user, so that we know who asked what.
82. As the business, I want every query capped at 30 s and 10,000 grouped rows, so that no single question can load the server.
83. As the business, I want no customer, loyalty member or staff dimension to exist in the model at all, so that personal data cannot be queried even by mistake.
84. As the business, I want the copilot's `sales_summary`, `orders_by_channel` and `callout_stats` to give the same figures as the analytics model once it is live, so that there is only one number for each thing.
85. As the business, I want a measure added or changed only through a reviewed change that passes parity checks and the evaluation set, so that the model stays trustworthy.
86. As the business, I want a measure that is removed from the model to show as retired on any view that used it, rather than breaking the board, so that model changes stay safe.
87. As a DBA, I want the replica to see only bounded, scheduled reads from one dbt login, and nothing written to `POS`, so that analytics never competes with replication.
88. As a DBA, I want a failed or stale dbt run to keep the last good data, never a gap, so that boards show stale data honestly rather than empty charts.
89. As an HQ user, I want every screen in English and Arabic, light and dark, with charts mirrored under Arabic, so that analytics feels like the rest of the OMS.

## Implementation Decisions

### A. Architecture (ADR 0006)

- **The path:** oms-react → SIS.Api (gate, validate, compile, cap, cache, audit) → Cube Core
  `/load` → the marts in `POS_Analytics` ← dbt (scheduled, bounded reads of `POS`).
- **Hosting** *(amended 2026-11-05, 749)*: **one container image** that infra runs on its existing
  Nutanix platform, exactly one instance, no persistent disk. It holds the Cube API with its
  refresh worker, Cube Store on localhost only, and dbt with its schedule inside (overlap guarded by
  a lock file). Its name is internal-only, with a Cloudflare certificate on 443. Only SIS.Api
  reaches it, and it has no internet egress.
- **Metabase is not used.** The prototype ran on Metabase over synthetic SQLite only as a stand-in.
  Nobody signs in to anything but oms-react.

### B. The semantic model (server: BackOffice `Analytics/`, with dbt and Cube in one tree)

- **The catalogue** is 745's, unchanged: four areas, the measures, the shared dimensions and the
  must-not-answer list.
  - Area 4, callouts and donor requests, is **declared but marked unavailable** until 753 closes.
  - Callout measures are SQL twins of `DispatchScorecardMath`, and parity with the scorecard door
    is their acceptance check.
- **The marts** are 748's:
  - the daily marts per area;
  - `fct_delivery`, one row per delivery, holding its first-event times (ADR 0081 of BackOffice);
  - shares are stored as numerator and denominator, never as a ratio;
  - every mart carries `_loaded_at`, and `mart_load_log` holds one row per run.
- **Refresh:** the `intraday` job runs every 15 minutes, swapping today's slice (and yesterday's
  before 02:00) in one transaction. The `nightly` job runs at 03:00, rebuilding the last 3 days and
  running `dbt test`. Source freshness runs first and fails the job closed.
- **Cube rules** (756):
  - every cube is `public: false`, and only views are public, so `/meta` is exactly the catalogue;
  - a custom Sunday week granularity;
  - `CUBEJS_DB_QUERY_LIMIT` and `CUBEJS_DB_QUERY_DEFAULT_LIMIT` are both 10000, and every query
    sends `total`;
  - `CUBEJS_DB_QUERY_TIMEOUT` is 30 s;
  - TLS: encrypted, server certificate trusted (`ANALYTICS_DB_TRUST_CERT=true`, owner ruling
    2026-11-05, 749 D8 (c)): the replica has only SQL Server's self-generated certificate. Pinned
    mode stays in the `driverFactory` for when a real certificate is installed.
- **Rates are computed from their parts.** `return_rate`, the shares and `take_rate` are always
  Σ numerator ÷ Σ denominator over the filtered set, never an average of per-store ratios.
- **Percentiles** are computed exactly per query (`PERCENTILE_CONT`, the twin of
  `DispatchScorecardMath.Percentile`) over `fct_delivery` and the fact tables. They are refused over
  a window longer than **92 days**. Counts and shares have no cap.
- **Measure metadata.** Each member carries, in its Cube `meta`:
  - its **shape**: `additive` (a count or sum), `rate` or `percentile`;
  - its **unit**: count, SAR, minutes, seconds, km or share;
  - its area;
  - `maxWindowDays`, where it has one;
  - its **label and description in English and Arabic**.

  The web and the AI read all of this from the model; none of it is copied into either.
- **Arabic labels** *(the map's last Arabic fog, settled here)*:
  - **Model labels live with the member, in both languages,** and are served by the model door.
    A new measure needs no web release.
  - The AI emits **member keys only**, never label text, so a view it makes reads correctly in
    either language.
  - An AI view's title is empty by default, so the screen generates it from the model labels.
    When the AI does give a title, it gives one in both languages.
  - Words around the labels, such as "by", "versus previous" and the chart chrome, are `t()` keys.
  - A model label is server-supplied data, so the zero-literal rule is satisfied.
- **Who changes the model** *(the map's governance fog, settled here; overrulable)*:
  - Any change is a pull request to the one `Analytics/` tree, made by the BackOffice dev team.
  - **The owner approves any new or reworded measure.** The wording rules apply, for example
    "value through our tills", never revenue.
  - A change ships only when:
    - `dbt test` and the till-value reconciliation pass;
    - scorecard parity passes for callout measures;
    - a contract check passes: no PII member exists, every cube is private, and every public member
      has a shape, a unit and both labels;
    - the D14 evaluation set passes on staging.
  - **Removing or renaming a member** first runs a usage report over the analytics store. A
    definition that still names a removed member renders a "this measure was retired" panel and
    never fails the board.

### C. SIS.Api: the analytics doors (proposed wire; BackOffice owns it once filed)

All calls go through `@/core/api`. Refusals are envelope business outcomes.

- **`GET Analytics/Access`** → `{ canView, canCurate }`.
  - **Absent or unreachable means denied**, the OMS probe pattern.
  - `canView` is a new `BackOfficeScreen` grant for Analytics. `canCurate` is the curator grant,
    working name `AnalyticsCurate`. BackOffice names both.
- **`GET Analytics/Model`** → the catalogue the screens and the AI share:
  - areas: `key`, `available`, and `unavailableReason` when it is not available;
  - measures: `key`, `area`, `shape`, `unit`, `maxWindowDays?`, `label{en,ar}`,
    `description{en,ar}`, and the dimension keys it may be broken down by;
  - dimensions: `key`, `kind` (time or category), `label{en,ar}`, and its values inline when the
    list is small and fixed (channel group, country).
- **`GET Analytics/DimensionValues`** with `dimension` and `search` → up to 50 `{ key, label }`,
  for the store, city and region pickers.
- **`POST Analytics/Query`** → the answer to one panel.
  - **Input:** either `{ viewId, revision? }` for a saved view, or an inline `definition` while
    editing. Plus the board's resolved filters, the cross-filter, and `compareToPrevious`.
  - **The server:**
    - checks the caller may read the view;
    - validates the definition against the model and the shape rules (E);
    - resolves the relative period in Riyadh time, with Sunday weeks, capped at today;
    - checks every member against `/meta`, compiles to `/load` and runs it.
  - **Returns:** `columns[]` (`key`, `role` dimension or measure, `shape`, `unit`), `rows[]`,
    `total`, `truncated`, the resolved `period{from,to}`, the `previous` rows when asked, plus
    `fetchedAt` and `dataAsOf`, the newest source event time of the last good run, from
    `mart_load_log`.
- **The analytics store.** Views and boards are both "items" behind one door family:
  - `GET Analytics/Items` with `kind` and `tier`, plus search;
  - `GET Analytics/Item/{id}`;
  - `POST Analytics/Item` creates the item as Personal;
  - `PUT Analytics/Item/{id}` with `{ definition, baseRevision }`;
  - `POST …/Copy`, `…/Share`, `…/Unshare`, `…/Certify` with `{ revision }`, and `…/Uncertify`;
  - `DELETE Analytics/Item/{id}`;
  - `GET …/Revisions`, which returns the last 20;
  - `POST …/Revert` with `{ revision }`.

  Each item carries `kind`, `title{en,ar}`, `subtitle{en,ar}`, `owner`, `tier`, `certifiedFrom?`,
  `copiedFrom?`, `sourceChangedSinceCopy`, `revision`, `updatedAt`, `updatedBy` and `definition`.
- **The store lives in SIS.Api's own backed-up database,** never in `POS_Analytics`, which is
  rebuildable and has no backups. The revisions keep full definition snapshots. Certification
  writes a frozen copy (755 item 14).
- **Refusal codes** (proposed):

| Code | Meaning | What the web does |
|---|---|---|
| `ANALYTICS-401` | no screen grant | the route's no-access state |
| `ANALYTICS-402` | needs the curator grant | shows the reason, hides the action next time |
| `ANALYTICS-403` | not yours to edit in place | offers **Save as my copy** |
| `ANALYTICS-404` | the item is not found or was deleted | the "view removed" panel or a not-found page |
| `ANALYTICS-405` | someone saved a newer revision | names who and when; offers a copy or a reload |
| `ANALYTICS-406` | invalid definition: an unknown or retired member, or a chart type that doesn't fit the shape | names the offending field in the editor, or shows the "this measure was retired" panel |
| `ANALYTICS-407` | a percentile over more than 92 days | says so and offers to shorten the window |
| `ANALYTICS-408` | the query passed 30 s | the panel's retry state |
| `ANALYTICS-409` | the analytics engine is unreachable | the panel's error state; the other panels keep going |
| `ANALYTICS-410` | the area is not available yet | the area's unavailable reason |

  An unknown code falls back to the server's `message` through `apiErrorMessage`. Cube's own
  errors are **mapped and scrubbed** (756) and never passed through.
- **Caching and load** *(the map's caching fog, settled here; values provisional on 750)*:
  - **Cube's cache** keys each query on a `refreshKey` that reads the newest good run in
    `mart_load_log`, checked every 30 s. A result is reused until dbt lands new data.
  - **SIS.Api adds a 30 s result cache** keyed by the canonical compiled query and the resolved
    period. It also **coalesces identical in-flight queries**, so ten wall screens on one board
    make one query per interval.
  - **No Cube pre-aggregations in v1.** The marts are already daily aggregates. Add one only for a
    measured query that misses its budget. Cube Store stays in the image, on localhost only, as
    Cube's cache and queue store.
  - SIS.Api caps **concurrent queries to Cube** at 8. That value is provisional, and 750 item 7
    ratifies it.
- **Audit:** every `Analytics/Query` and every store write records the acting user, the item, the
  compiled query's shape, its row count and its milliseconds. AI calls also write 734's D6 record.

### D. The AI: three tools in 734's one catalogue (746)

- **`describe_model`** (read-only) returns the `Analytics/Model` catalogue, optionally for one
  area. It never lists a PII member, because none exists.
- **`semantic_query`** (read-only) takes `{ measures[], dimensions[], filters[], grain, order?,
  limit?, compareToPrevious? }` and returns the aggregate rows. It goes through the same
  validator, caps and audit as the screens. Its trace entry is D10's `{ tool, input, rows, ms, ok }`.
- **`create_view`** (writes only our analytics store):
  - **Input:** a validated `semantic_query`, a chart type, and an optional bilingual title.
  - **Writes:** a **Personal** analytics view for the acting user.
  - **Returns:** its id.

  The chart type passes the same shape validator as the editor. The AI creates views, never boards,
  and never certifies.
- **Surface tags:** the D1 registry gains a per-tool tag. The read tools are on `panel` and `mcp`;
  `create_view` is on `panel` only. **MCP stays read-only.** This amends 734 D1.
- **The D10 answer** gains `viewRefs[]`, each `{ id, title{en,ar} }`, for views created in that
  answer. The copilot panel shows each as an "Open view" link to `/analytics/view/:id`. A missing
  `viewRefs` is read as empty.
- **The trace labels** for the three tools join the copilot's tool → label map: "Reading the
  analytics model", "Running the analytics query" and "Saving a view".
- **Questions outside the model** get 734's `cannot-answer` outcome, worded "I can't answer that
  from the analytics model". 745 §5 is the list.
- **One definition:** 734's `sales_summary`, `orders_by_channel` and `callout_stats` keep their
  names and schemas for the pitch, and are **re-pointed to a fixed `semantic_query` at parity**.
  That same step retires BackOffice 3346's interim rollup. Both are later BackOffice work, not v1
  web work.
- **D14 extends** with 745's fifteen questions. A query case passes when:
  - the requested measures, dimensions, filters and grain match;
  - no number appears that the query did not return;
  - for `create_view`, the chart type fits the shape.

  Q11–Q13 join once 753 closes.

### E. Chart types and the shape rules (755 Q3, with two amendments)

- **The eight types:** KPI, line, stacked area, bar (vertical, horizontal, stacked or grouped),
  donut, table with cell bars, heatmap and combo. What each accepts is 755's table.
- **A rate or percentile measure is never stacked and never in a donut.** A donut takes one
  additive measure, with at most 6 slices plus "Other".
- **The same rules are enforced in three places:** the editor offers only the types that fit, the
  server refuses the rest with `ANALYTICS-406`, and `create_view` uses the server's validator. The
  web's copy of the table exists only to choose what to offer. The server is the authority.
- **Amendment 1, combo has one axis per chart** *(dataviz rule, overrulable)*. 755 drew the combo
  as a bar and a line on two y-axes. A dual-axis chart misleads, so v1 draws the combo as **two
  panes stacked on one shared x-axis**, the volume measure as bars above and the rate measure as a
  line below, each with its own single y-axis. It still answers Q12 and Q13.
- **Amendment 2, five colours, then "Other"** *(dataviz rule, overrulable)*. The validated
  categorical palette has five slots. 755 allowed up to 8 line series. v1 caps a breakdown at
  **5 named series plus "Other"**. Lifting the cap to 8 needs three more slots validated in light
  and dark, which can be a build ticket on its own.

### F. The web half: the `analytics` area

- **The area** is a new folder, `features/analytics/`, behind the `/analytics` URL prefix and a new
  Analytics menu group. Its first feature is **`boards`** (i18n namespace `boards`). It is a tight
  cluster of screens: the home, the board page, the analytics view page, the chart editor, the
  board editor and TV mode. There is one `api` module for every Analytics door, wrapped in TanStack
  Query at the Page. It is registered in `core/i18n`, `app/router` and the menu model, as in the
  feature checklist.
- **The routes:**
  - `/analytics`, the home;
  - `/analytics/board/:id`;
  - `/analytics/board/:id/edit`;
  - `/analytics/view/:id`;
  - `/analytics/new?kind=view|board`, the builder.

  Board filters, the cross-filter and the refresh interval live in the query string, and that
  string **is** the permalink. `tv=1` opens TV mode.
- **The copilot feature** only links to `/analytics/view/:id` by route string. It never imports the
  analytics feature.
- **The ask box on `/analytics`** opens the copilot panel with the question filled in. It goes
  through the app shell's panel opener, which moves into `core` if it doesn't live there already.
  There is never a second Ask client.
- **The chart wrapper is a new `core/charts`,** the only place Recharts is imported. Recharts 3 is
  pinned to an exact version (3.10.1 at the time of writing). The wrapper owns:
  - **RTL:** every chart sits in a `dir="ltr"` box. Mirroring comes only from props: `XAxis
    reversed` and the y-axis on the right. Custom SVG labels anchor to the right edge under
    Arabic. A logical exception is commented as the logical-Tailwind rule allows.
  - **Tokens:** new `--chart-1…5` tokens in light and dark, with the values validated in the
    Recharts research. The status colours are never series colours. Ticks, gridlines and legend
    text use the ink tokens. The colour-literal gate still holds.
  - **Colour by entity, never by rank:**
    - channel groups and countries have a **fixed slot** each;
    - for any other breakdown, the definition stores a member → slot map when it is saved, and a
      new member takes the next free slot;
    - filtering never repaints the members that remain;
    - the prototype's rank-based colouring is not carried over.
  - **Formats:** numbers, SAR, minutes, percentages and dates go through `Intl` under the active
    locale. Machine values are isolated per the bidi rule. `fsi()` never reaches a tick formatter
    or an export.
  - **The forms:** KPI tiles with a sparkline, line, area, the bars, donut, combo (two panes), and
    a **heatmap**. Recharts has no heatmap, so the wrapper draws it as an accessible
    single-hue sequential grid. The **table** form is AG Grid, spreading the core grid base, with
    a cell-bar renderer.
  - **Hover and accessibility:** a tooltip on every mark; Recharts' `accessibilityLayer`; a
    legend for two or more series, in ink text; and a table view for every chart.
- **Loading feedback** (the owner asked for it; the prototype commits `244a080c` and `01286f77`
  show it):
  - Each panel is its own query, keyed by its canonical effective query, with
    `placeholderData: keepPreviousData`.
  - **While a panel fetches:**
    - the previous chart stays, dimmed;
    - a spinner sits by the title and an indeterminate bar runs along the top edge;
    - an "Updating…" label shows, with `aria-busy` set;
    - the panel never blanks.
  - **The filter strip** shows "Updating… n of N panels", with a determinate bar and a polite live
    region.
  - Only the panels whose effective query changed re-run, so a cross-filter leaves the clicked
    panel alone. A superseded answer is dropped, because the newer key wins.
- **Effective query.** A panel's query is its definition, plus the board filters it has not opted
  out of, plus the cross-filter (unless it opted out). The period is sent as the **relative** token
  ("last 30 days"), and the server resolves it, so a saved board keeps its meaning.
- **Drill:**
  - **Drill by** re-asks the same panel with one more dimension and a breadcrumb. It is not saved
    unless the user picks "Save as view".
  - **Drill to detail** hands off by route:
    - store or city → the Deliveries list, filtered;
    - a callout → Dispatch;
    - till sales → no detail drill.

    The target screen's own grants and masking apply. Where a target has no filter entry for that
    dimension yet, its ticket adds one, or that drill is left out.
- **Panel actions:**
  - fullscreen;
  - refresh, with "fetched N ago";
  - view as table;
  - download CSV and xlsx from the panel's rows through the core xlsx writer, with isolates
    stripped;
  - download PNG, serialised from the SVG;
  - permalink.
- **Freshness:** every panel shows "data as of HH:MM" from `dataAsOf`. When `dataAsOf` is more than
  **45 minutes** behind now (three missed intraday runs; provisional), the panel shows a
  "data is behind" chip in the attention status, with an icon and a label.
- **Editing:** the chart editor is 755 items 4–6 and the board editor is items 7–11, with the
  colour picker limited to the chart tokens. Saving follows the tiers:
  - your own item saves in place;
  - `ANALYTICS-403` opens **Save as my copy**;
  - `ANALYTICS-405` names who saved and offers a copy or a reload.
- **Board grid:** 12 columns in logical order, so it mirrors under RTL. It uses fixed row units, a
  minimum size per chart type, and keyboard move and resize.
  - **Open build question:** whether a grid library such as react-grid-layout can mirror under RTL
    and pass the colour and control gates. The board-editor ticket starts with a half-day check. If
    no library passes, the grid is hand-rolled on CSS grid.
- **Auto-refresh:**
  - **The picker** offers Off, 30 s, 1 min, 5 min and 15 min. A viewer's choice lasts for their
    session only.
  - **The loop** is one per board, staggered across the panels, and paused while the tab is hidden.
  - **The floor** is 30 s, provisional on 750. If 750 says the replica can't carry it, the floor
    becomes 1 min, through config.
- **TV mode** hides the shell, makes the filters a read-only chip strip, keeps the cross-filter and
  the panel actions, and exits with Esc. It still needs a signed-in session.
- **i18n:** every label is a `t()` key in the `boards` namespace, in `en` and `ar`. Chart-wrapper
  words go in `common`. Model labels and dimension values are server data, isolated by kind.

## Testing Decisions

- **Test only external behaviour.** On the web, assert what a user sees: the panels, colours,
  loading states, refusal messages and routes. On the server, assert what a client gets: rows,
  codes, the `/meta` contents and the store's state. Never assert internal calls.
- **Web seam 1: pure modules (vitest, in-memory).** One family in the analytics feature, plus
  `core/charts`:
  - **the shape rules:** given a definition and the model, which chart types are offered and why
    one is unavailable. The cases are 755's table and the two amendments.
  - **the effective query:** the definition plus board filters, opt-outs and the cross-filter,
    resolving to one canonical query key. The same inputs always give the same key; a changed
    filter gives a new key only for the panels it reaches.
  - **the result to view model:**
    - fixed slots for channels and countries, and the saved member → slot map;
    - the top 5 plus "Other";
    - formats by unit, and the compare-previous deltas;
    - a rate is never stacked;
    - `truncated` and empty results.
  - **tier and actions:** tier × owner × curator → edit in place, save as copy, share, certify,
    un-certify, delete.
  - **the wire:** each `ANALYTICS-*` code maps to its i18n key, with an unknown code falling back
    to the server message; absent arrays are read as empty; `dataAsOf` sets the "data is behind"
    state.
  - **the permalink:** board filters, the cross-filter, `tv` and the refresh interval survive
    encode → decode.
  - **the layout reducer**, if the grid is hand-rolled: move, resize, the minimum sizes and logical
    order.

  Prior art: `src/features/copilot/answer.test.ts`, `trace.test.ts` and `refusal.test.ts`, and
  `src/features/oms/dispatch-scorecard/figures.test.ts`.
- **Web seam 2: one Playwright drive (`tools/analytics-drive.mjs`) against stubbed envelopes.** It
  stubs Access, Model, Query (with delays, so the loading states are seen) and the Item doors. It
  covers:
  - the probe hiding the menu item and routes;
  - the home's ordering;
  - a board with all eight types;
  - a filter change showing feedback within half a second and streaming panel by panel;
  - the cross-filter and the opt-out;
  - drill by, and the detail hand-off route;
  - each panel action;
  - the editor offering only the fitting types;
  - save in place, save as copy, and the conflict;
  - share, certify and revert;
  - each refusal code;
  - auto-refresh pausing while hidden;
  - TV mode;
  - en, ar and dark screenshots.

  Prior art: `tools/copilot-drive.mjs`, `tools/dispatch-scorecard-drive.mjs` and the prototype's
  `tools/recharts-board-drive.mjs` (on `prototype/747-embedded-bi`).
- **The copilot's additions** extend its existing seams: `viewRefs` and the three new trace labels
  in its answer and trace modules, and an "Open view" step in `tools/copilot-drive.mjs`.
- **No new runner.** vitest is already bootstrapped. React Testing Library is still not installed
  (spec 083's ruling). Components are thin renderers over the pure modules and are verified by the
  drive plus `typecheck`.
- **The server, owned by BackOffice:**
  - **dbt:** `dbt test`, the till-value reconciliation, and scorecard parity for area 4.
  - **The Cube model contract:** no PII member, every cube private, every public member carrying
    shape, unit and both labels.
  - **The compiler:** definition → `/load` golden tests, and validator tests over the same case
    table as the web's.
  - **The store:** tiers and permissions, the revision conflict, certify-freezes-a-copy, revert,
    and delete leaving references intact.
  - **The cache:** coalescing of identical in-flight queries, and staleness keyed on
    `mart_load_log`.
  - **The audit**, for each door.
  - **The AI:** the D14 set extended with Q1–Q15, run against every connector before any prompt,
    model, tool-description or model change ships.

## Out of Scope

- **Metabase in any role,** and Metabase sign-on: there is no Metabase engine, UI, embed or
  card store in v1. A Pro power-user tier would be a new effort.
- **A SQL editor, arbitrary joins, anything outside the semantic model, and pivot tables.**
- **Map panels** (a basemap would need remote tiles) and **tabs** on boards.
- **Scheduled email, subscriptions, alerts, thresholds and annotations.**
- **Row-level security** for regional or store managers. v1 is HQ only.
- **Customer, loyalty-member, staff, product or material analytics; revenue, margin or cost;
  forecasts; insurance approvals or claims; SAP, IDocs or coupons; free-text contents.**
- **The AI building boards or certifying anything, and `create_view` on MCP.**
- **A non-expiring kiosk login for TV mode.**
- **Cloud warehouses or cloud BI.**
- **The pitch's demo** (map 717), and re-pointing 734's D2 tools, which comes later, at parity.

## Further Notes

- **What is provisional,** each with its trigger (748's re-open table still applies):
  - **The 30 s refresh floor, the 30 s / 10,000-row caps, the concurrency cap of 8, and no Resource
    Governor** wait on 750's off-hours run and the DBA's answers.
  - **The 92-day percentile cap** can be lifted on a measured timing.
  - **The 45-minute "data is behind" threshold** may be tuned.
- **Gates:**
  - **Area 4** (callouts and donor requests, Q11–Q13) is declared from the start but unavailable
    until [753](753-the-dba-adds-the-callout-and-donor-request-tables-to-the-replica-publication.md)
    closes. Its marts and measures are the last slices.
  - Nothing else waits on 753.
  - [750](750-the-owner-runs-the-replica-headroom-probe-and-the-dba-answers-its-checklist.md)
    gates no slice; it only confirms the provisional values above.
- **Build inputs, not decisions:** infra's host name, its IP, and the SIS.Api source IPs (749). The
  first server ticket records them.
- **BackOffice asks (not filed from here; BackOffice is read-only from this map).** The suggested
  split:
  1. the `Analytics/` tree, dbt areas 1–3 with both jobs and the load log, and the single image
     (amended 2026-11-05; was "the host's compose file");
  2. the Cube model for areas 1–3, with the contract check, the Sunday week and the TLS
     `driverFactory`;
  3. the `Analytics/Access`, `Model`, `DimensionValues` and `Query` doors, with the compiler, the
     validator, the codes, the cache, the concurrency cap and the audit;
  4. the analytics store: items, tiers, revisions, certification and the curator grant;
  5. the three copilot tools, the surface tag, `viewRefs` and the D14 extension;
  6. area 4, after 753;
  7. later, at parity: re-pointing D2's three tools and retiring 3346's rollup.
- **Web tickets** (for `/to-tickets`), in a suggested order:
  1. the probe, route, menu and the home's empty state;
  2. `core/charts` with the chart tokens, RTL, formats and the loading frame;
  3. the analytics view page rendering a definition in all eight types;
  4. the board page, with filters, cross-filter, drill and panel actions;
  5. the chart editor, and saving and copying;
  6. the board editor, starting with the grid check;
  7. tiers, curation, revisions and deletion;
  8. auto-refresh and TV mode;
  9. the copilot additions and the ask box;
  10. area 4's measures, after 753;
  11. the live walk against staging.
- **Evidence:** the prototype on `prototype/747-embedded-bi` (worktree `oms-react-proto747`), at
  `/prototype/analytics`:
  - the `linked` variant: cross-filter and the streaming loading;
  - the `recharts` variant: every Recharts form, en, ar and dark;
  - the `native` and `superset` variants: authoring.

  The screenshots are in `.issues/assets/747-shots/`, `754-shots/` and `741-recharts-shots/`. The
  prototype runs on Metabase over synthetic data only. Nothing in it is production code.
