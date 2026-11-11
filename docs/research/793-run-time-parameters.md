# 793 — Run-time report parameters: Cube Core and four BI tools

Research for [795](../../.issues/795-how-do-cube-and-comparable-bi-tools-model-run-time-report-parameters.md)
(map [793](../../.issues/793-hq-analytics-v2-team-reports-with-parameters-over-more-sources-map.md)), gathered
2026-11-06. It feeds [797](../../.issues/797-what-parameters-may-an-author-declare-and-how-do-they-bind-to-panels.md)
and is also relevant to 798 and 801. It decides nothing.

"Our model" means the v1 code as it stands: the web half in `src/features/analytics/boards/` and the SIS.Api
compiler in BackOffice `Sartawi.Retail.Data/Modules/Analytics/`. External claims cite official docs or source. Any
statement marked **(inference)** is mine, not a source's.

## Summary for 797

1. **Cube Core has no "parameter" concept.** The nearest things are context variables (`FILTER_PARAMS`,
   `COMPILE_CONTEXT`) and the `queryRewrite` hook. None of them is a user input with a type and a default. Every
   parameter type 795 lists can be expressed in **ordinary `/load` JSON**: filters, `timeDimensions.dateRange`,
   `order`, `limit`, and the choice of members. So SIS.Api can resolve parameters *before* `/load`, and Cube never
   has to know one existed.
2. **That is what v1 already does with board filters.** `AnalyticsQueryCompiler.Compile` merges the board's filters
   and period into the definition, resolves the period to explicit dates, and builds one canonical `/load`
   (`AnalyticsQueryCompiler.cs:163-171, 217, 280-310`). A v2 parameter is a generalisation of this path, not a new
   one. The cache key is the compiled query (`:46-48`), so resolved parameter values key the cache with no extra
   work.
3. **Avoid putting parameter values in the JWT or `COMPILE_CONTEXT`.** Each distinct `contextToAppId` value compiles
   its own copy of the model. The LRU holds 250 by default. Values carried this way would recompile per value set,
   and they would also bypass the `/meta` check SIS.Api relies on. `FILTER_PARAMS` only reads filters already in the
   query, and Cube calls heavy use of it "bad practice". None of the v1 model files or `cube.js` uses any of these
   (grep, 2026-11-06).
4. **Every tool separates two things,** and so should 797:
   - **filter-like inputs**, which narrow rows on a field and are mapped per card or tile;
   - **template parameters**, which change the query's shape: Looker `parameter` + Liquid, Lightdash `parameters`,
     Metabase basic SQL variables, Superset Jinja.

   The second kind is where the tools inject values into SQL. In our model it becomes "pick one of an
   author-declared allowlist of members".
5. **The binding pattern is the same everywhere.** A dashboard-level input is mapped per card to one field:
   - Metabase connects each card's column;
   - Superset scopes the filter, then targets a dataset column;
   - Lightdash defaults to tiles with the same field, with a per-tile override;
   - Looker has "Tiles to update", with a field per tile.

   v1's model is already this: the filter dimension is matched by key, with a per-panel `optOut`.
6. **Defaults, required and multi-value are standard everywhere.** Metabase, Looker and Lightdash all have a
   "required" flag. Lightdash forbids a required filter from having a default; Metabase *requires* one. That
   divergence is worth a ruling in 797.
7. **Relative date defaults** ("yesterday") exist in every tool. Lightdash's only dynamic parameter default is
   `today`. v1 already has relative tokens, `yesterday` included, resolved server-side in Riyadh time
   (`AnalyticsPeriods.cs:62-106`). The owner's example needs no new mechanism for its period.
8. **A threshold on a measure** is a Cube measure filter, compiled to `HAVING`. Today's compiler emits only
   `equals` on category dimensions (`AnalyticsQueryCompiler.cs:155-157, 293-297`), so measure filters are new
   compiler work. Cube does not allow a dimension filter and a measure filter inside one `and`/`or` group.
9. **Top N** is `order` + `limit`. In v1, `chart.topN` becomes Cube's `limit` only when each row is one series
   (`:209-214`). "Top N stores, then their daily trend" needs two queries, or Cube's multi-stage `rank`, which needs
   the preview Tesseract planner. Under the 10k cap it is the one type that cannot be one plain `/load`.
10. **Choosing the measure or breakdown** is a Looker parameter + Liquid in the tools, which is SQL injection by
    design. Our safe equivalent is to swap a member from an allowlist the author declares, then run the normal
    validation: the one-view rule (`:113-115`), the shape table (`:173-176`) and the percentile window (`:220-229`).
    Each allowed value can make a different chart shape valid or invalid, so validate every value when the report
    is saved, not only at run time.
11. **Scheduled delivery always stores values per schedule:**
    - Looker's schedule has a Filters tab that edits values only and cannot add filters;
    - Lightdash's delivery keeps its own filter values;
    - Metabase's subscription uses the dashboard defaults, and overriding them is Pro/Enterprise;
    - Superset stores `extra.dashboard.nativeFilters`, validated since March 2026.

    None of them lets a schedule add an input the dashboard lacks. This bears on 801.
12. **Permalinks encode values by input name** in Metabase (`?category=a&category=b`), Lightdash and Looker. Superset
    uses a Rison blob keyed by filter id. v1's permalink (`permalink.ts`) already uses Metabase's repeated-key shape.

## 1. Our model today (what a parameter would extend)

- **Board filters** are six fixed inputs: a period plus member lists for city, region, store, channel and country.
  - The types are `BoardFilters` (`src/core/models/analytics.ts:257-264`) and the defaults are `BASE_FILTERS`
    (`boards/board.ts:12-19`).
  - The source is spec 766 story 20 (`.issues/766-…:112`).
  - A board saves its own defaults, and the URL overrides them (`board.ts:22-24`, `permalink.ts:280-287`).
- **The binding is implicit, by dimension key.**
  - `FILTER_DIMENSIONS` maps each strip key to a model dimension (`effective-query.ts:106-112`).
  - A filter reaches a panel unless the panel opted out, or none of its measures breaks down by that dimension
    (`effective-query.ts:145-151`).
  - The server drops an inapplicable board filter, and *refuses* an inapplicable definition filter
    (`AnalyticsQueryCompiler.cs:148-171`).
- **The period** travels as a relative token or `from..to` (`effective-query.ts:118`).
  - Only the server resolves it: Riyadh dates, Sunday weeks, capped at today (`AnalyticsPeriods.cs:28-42`).
  - It reaches Cube as an explicit `dateRange` pair with no `timezone` (`AnalyticsQueryCompiler.cs:283-287`).
  - The board's period overrides the view's own (`:217`).
- **Sort and limit.** The compiler takes `query.order` or `chart.sort` (`:179-197`) and a limit of 1-10,000
  (`:204-208`). `total: true` is always sent (`:308`).
- **The Cube call.**
  - SIS.Api mints an HS256 JWT `{sub:"sis-api", actor, iat, exp}` (`AnalyticsCubeClient.cs:162-172`).
  - `cube.js` holds only a `driverFactory`: no `queryRewrite`, `contextToAppId` or `checkAuth`
    (`Analytics/cube/cube.js:22-34`).
  - So Cube has one compiled model, and the security context is used only for logging (756 item 7).
    *(inference: with no `contextToAppId`, the app id is constant)*
- **Governance from 756 that any parameter design must keep:**
  - Every member is checked against `/meta` before `/load`. `public: false` is enforced only *after* the SQL runs
    (756 item 3).
  - Cube's errors are mapped and scrubbed.
  - The 10k row cap is Cube's `CUBEJS_DB_QUERY_LIMIT`; asking for more is a 500.
  - The 30 s timeout applies.
- **A fact for the owner's example:** `mart_orders_daily` already carries `document_type`, but the cube keeps it
  private and out of the catalogue (`Analytics/cube/model/cubes/orders_daily.yml:1-2`). The "two order types"
  in the example are probably a 796 model change rather than a parameter feature. *(inference)*

## 2. Cube Core: each mechanism

| Mechanism | What it is | Core or Cloud | Can SIS.Api resolve it before `/load` and keep the governed path? |
|---|---|---|---|
| **Query filters** (`filters[]`: `equals`, `notEquals`, `gt/gte/lt/lte`, `contains`, `set/notSet`, `inDateRange`, nested `and`/`or`) | The query's own `WHERE` (dimension) or `HAVING` (measure) conditions | Core: the REST query format [C3] | **Yes, and this is the path.** A member-list parameter becomes `equals`, and a threshold becomes `gt`/`gte`/`lt`/`lte` on a measure. Measure and dimension filters cannot share one logical group [C3]. |
| **`timeDimensions.dateRange`** | Either explicit dates or a relative string parsed by Chrono (`yesterday`, `last 360 days`) | Core [C3] | **Yes, already done.** SIS.Api sends explicit dates, because Cube's relative ranges use Monday weeks and UTC (756). Cube's `compareDateRange` exists, but SIS.Api sends its own previous-period load (`AnalyticsQueryCompiler.cs:243-247`). |
| **`order`, `limit`, `offset`, `total`** | Sorting and paging | Core [C3] | **Yes.** Top N is `order` + `limit`, capped by `CUBEJS_DB_QUERY_LIMIT`. |
| **Members chosen** (`measures[]`, `dimensions[]`) | What the query returns | Core | **Yes.** Choosing a measure or breakdown is just which member keys SIS.Api writes. They are still checked against `/meta`. |
| **`FILTER_PARAMS`** | Lets a cube's SQL read the values of filters *already in the query*, e.g. to prune partitions inside `sql_table`: `{FILTER_PARAMS.cube.member.filter(sql)}`. Several uses need `FILTER_GROUP`. Docs: "Heavy usage … is considered a bad practice", for pushdown only [C1] | Core [C1] | **Not a parameter mechanism.** It cannot carry a value that is not a filter. Our marts are plain tables, so nothing needs pushdown. It is not needed; it would only matter for a future `sql:`-based cube over a big source. |
| **`COMPILE_CONTEXT`** | The security context, plus `extendContext` data, read at model *compile* time. It "is evaluated only once per each key generated by `context_to_app_id`" [C1]. It drives dynamic models, masking and per-team visibility [C2] | Core [C1][C2] | **No, for parameters.** Each distinct app id gets its own compiled model, kept in an LRU (`compiler_cache_size`, default 250) [C4]. A per-value compile would thrash, would need `scheduledRefreshContexts` for any pre-aggregation [C4], and would make `/meta` vary by context. That would break "check against `/meta`" unless SIS.Api fetched `/meta` per context too. It is the right tool only for RLS or tenancy, which 793 rules out. |
| **Security context / `checkAuth`** | The JWT payload becomes `securityContext` [C2][C4] | Core | **Keep it as is (actor only).** Passing parameters through the JWT would make Cube, not SIS.Api, interpret user input. |
| **`queryRewrite`** | A hook that amends or rejects each query before processing, typically by appending RLS filters [C2][C4]. The docs note it has no built-in access to model metadata [C4] | Core [C4] | **Possible, but redundant.** SIS.Api already is the rewrite step. A second rewrite inside Cube would split the governance in two, and the audit records SIS.Api's compiled query, not Cube's rewritten one. |
| **`SECURITY_CONTEXT` variable** | Deprecated: "can be removed without further notice" [C1] | Core | Do not use. |
| **Multi-stage measures** (`rank`, `time_shift`, percent of total) | Measures computed over another measure's result | Core, but needs the preview Tesseract planner (`CUBEJS_TESSERACT_SQL_PLANNER`). Pre-aggregations do not accelerate them [C5][C6] | **Out of v2's reach for now.** This would be the only one-query route to "top N per group". It is preview, and untested against mssql here. |
| **Cloud-only items seen** | The auth integration and the `cubeCloud` context key [C2]. `checkAuth` errors are 500 on Core and 403 on Cloud [C4] | Cloud | Not relevant. |

**Verdict.** The likely shape holds. Parameters are resolved by SIS.Api into ordinary `/load` JSON, so Cube sees no
parameter. It holds for:
- member lists (`filters` with `equals`);
- dates (`dateRange`);
- thresholds (a measure filter, compiled to `HAVING`);
- choice of measure or breakdown (the members chosen).

It holds only partly for **top N with a second dimension or a date**. The only one-query route is the preview
multi-stage `rank`. The other route is two `/load`s: rank first, then filter by the winners. Both breach v1's rule
of one query per panel. *(inference)*

## 3. Metabase

- **Where they live.** Parameters live on two levels.
  - **Dashboard filters.** The types are date (single, range, relative, month/quarter), location, ID, number
    (`=`, `≠`, between, `≥`, `≤`), text/category and boolean. There is also a **time grouping** parameter, which
    "doesn't filter data … just changes the time granularity" [M1].
  - **On a native SQL question, variables.**
    - **Basic** variables are text, number, date or boolean. They are inserted as values, and a basic date
      variable supports "Single Date" only [M2][M3].
    - **Field filter** variables are bound to a column, which gives the smart widgets [M2].
    - `[[ … ]]` marks an optional clause. A default can be written with a comment trick:
      `[[ {{p}} --]] default` [M4].
- **Defaults and required.** A filter takes a "Default value". "Always require a value" also needs one: "If you
  require a filter, you'll also need to supply a default value" [M1].
- **Multiple values.** "People can pick" one value or several. A basic variable needs `IN ({{var}})` written in its
  SQL [M1][M3].
- **Linked filters.** A child filter's options narrow by its parent's value.
  - This works only where the columns are related in the table metadata, by being in the same table or by a
    foreign key.
  - It ignores the model or question logic.
  - It does not work with basic SQL variables or with custom-list value sources [M5].
- **Mapping to cards.** "For each widget that you add, you'll need to tell Metabase which column the filter should
  update for each card". Metabase offers auto-connect to similar cards [M1].
- **URL.** `?filter_name=value`; repeat the key for multiple values; `#hide_parameters=` hides a widget [M6][M2].
- **Scheduled delivery.** Subscriptions "apply those default values". Customising values per subscription is "only
  available on Pro and Enterprise" [M7].

## 4. Apache Superset

- **Where they live.** Parameters live on two levels.
  - **Dashboard native filters.** The plugin types are `filter_select`, `filter_range`, `filter_time`,
    `filter_timecolumn` and `filter_timegrain` (`constants.ts` `FilterPlugins`) [S1].
  - **Inside a virtual dataset's SQL, Jinja macros.** These are `filter_values('col')`, `get_filters('col')` (with
    the operator) and `url_param('x')`. The docs warn that `filter.get('val')` is not escaped, and point to
    `|where_in` for multiple values [S2].
- **The persisted shape** is the `Filter` type [S1]. Its key fields are:
  - `targets` (dataset and column);
  - `scope { rootPath, excluded }`;
  - `cascadeParentIds`, which is how dependent filters link;
  - `defaultDataMask`, the default;
  - `controlValues`, the per-type options;
  - `requiredFirst`, `chartsInScope` and `tabsInScope`.
- **Mapping to charts is by scope.** The scope is the root or tabs, minus the charts excluded. Superset works out a
  common root and a list of excluded charts (`FilterScope/utils.ts` `findFilterScope`) [S1]. The column a filter
  applies to comes from its target. *(inference from the type: a filter on dataset A reaches charts on dataset B
  through column name matching)*
- **Defaults, required and multi-value.** Select filters have a `default_value`. A required select filter with no
  default stores a match-nothing default, unless "default to first item" is on [S3]. Multi-select lives in
  `controlValues`. *(inference from source; the user docs are thin)*
- **URL.** `native_filters=<rison>`, keyed by filter id, each value a `DataMask` [S1].
- **Scheduled delivery.**
  - A report scheduled from a dashboard stores `extra.dashboard.nativeFilters`.
  - PR #38715 (merged 2026-03-20) validates them, and deactivates a report whose filter was removed [S4].
  - A known bug drops that state for per-tab reports [S5].

## 5. Lightdash

- **Two separate mechanisms.**
  - **Dashboard filters** work on dimensions *and metrics* (saved filters with a default; viewers override them)
    [L1].
  - **Parameters** are declared in code [L2]:
    - project-wide in `lightdash.config.yml`, or per model;
    - their properties are `label`, `type` (string, number or date), `options`, `options_from_dimension` (first 50
      values), `default` (`today` is the only dynamic date default), `multiple` and `allow_custom_values`;
    - they are referenced as `${lightdash.parameters.x}` in dimension or metric SQL, `sql_on` joins, `sql_from` and
      `sql_filter`;
    - values "are always rendered as quoted string literals" [L2].
- **Mapping to tiles.**
  - A filter "starts out applied to tiles that have the same field". The editor can tick other tiles and pick a
    field of the same type for each; YAML `tileTargets` excludes a tile [L1].
  - "Parameters can't be mapped per tile" [L1].
  - For parameters, the dashboard value comes first, then the parameter `default`, then the chart's saved value
    [L2].
- **Required.** A required filter "must start empty, so the toggle can't be combined with a default value".
  "Requirement groups" mean "at least one of" these filters must be set. Until then, tiles stay locked [L1].
- **Linked filters.** Value suggestions take into account "all relevant filters, including those applied to fields
  from joined tables" [L1].
- **Multiple values.** Strings and numbers can take several values; "date and boolean filters don't have this
  option" [L1].
- **URL.** Viewer changes are kept in the URL, so "sharing the link shares the values" [L2].
- **Scheduled delivery.** "Each delivery keeps its own values" for the saved filters. A delivery can change or
  remove a filter, but "can't add filters the content doesn't already have". All recipients of one delivery get
  the same values [L3]. The docs do not say whether deliveries set parameters [L3].

## 6. Looker

- **Three constructs.**
  - **Dashboard filters** on fields [K3].
  - **`parameter` fields** in LookML. These are "filter-only" fields [K1]:
    - the types include `string`, `unquoted` (A-Z, 0-9, `_ . $` only, for column or table names), `date_time` and
      `yesno`;
    - `allowed_value` gives label/value pairs, alongside `default_value` and `suggest_dimension`;
    - they are referenced as `{% parameter p %}` (inserted as is) or `p._parameter_value` (for `{% if %}` logic);
    - the canonical use is a **dynamic measure** or dimension;
    - they are **single-value only** [K1].
  - **Templated filters**, `{% condition f %} col {% endcondition %}`. These emit a whole logical expression, not a
    raw value, so they suit ranges and searches. Liquid parameters suit "a finite set of options" [K2].
- **Mapping to tiles.**
  - "Dashboard filters can apply to all tiles … or to only one".
  - By default a filter applies to tiles from the same Explore; for each tile, the editor can "choose which field
    will be affected by the filter" ("Tiles to update") [K3].
- **Defaults, required and multi-value.** The default is optional. A required filter means "the dashboard won't run
  until you select a filter value". "Allow multiple filter values" is a control option [K3].
- **Linked filters.** One filter's options can narrow another's; "Linked filters work in one direction, from parent
  to child" [K3].
- **Cross-filters** take the highest precedence [K3].
- **URL.** Dashboard URLs carry the filters as query params. Special characters in names are encoded [K3].
- **Scheduled delivery.**
  - The schedule's Filters tab can "edit the values for any existing filters … the dashboard itself won't be
    affected". It cannot add filters.
  - A required filter must have a value before the schedule saves.
  - A filter added to the dashboard later is "is any value" for an existing schedule [K4].

## 7. Comparison

| Aspect | Metabase | Superset | Lightdash | Looker | v1 (ours) |
|---|---|---|---|---|---|
| Where declared | Dashboard filter; SQL variable on a question | Native filter on the dashboard; Jinja in a dataset | Dashboard filter; `parameters` in YAML (project or model) | Dashboard filter; LookML `parameter` / `filter` field | Six fixed board filters on a board; view's own filters |
| Who declares | Dashboard editor; SQL author | Dashboard editor; dataset author | Editor; dbt/YAML author for parameters | Dashboard editor; LookML developer for parameters | Board author picks values; set of inputs fixed |
| Types | date (incl. relative), location, ID, number, text, boolean, time grouping | select, range, time, time column, time grain | dimension/metric filters (relative dates); parameters: string, number, date | by field type; parameter: string, unquoted, date_time, yesno… | period (relative/fixed), 5 member lists |
| Default | yes | yes (or first item) | yes; `today` for date params | yes | board-saved, URL overrides |
| Required | yes, needs a default | yes (match-nothing default) | yes, **forbids** a default; "at least one of" groups | yes | no |
| Multi-value | yes | yes | strings/numbers; parameters `multiple` | filters yes; **parameters no** | yes (lists) |
| Linked/cascading | via FK metadata | `cascadeParentIds` | suggestions honour other filters | parent→child | none (DimensionValues search only) |
| Bind to cards | field per card, auto-connect | scope + target column | same field auto; field per tile; params not per tile | Tiles to update, field per tile | by dimension key + per-panel opt-out |
| Filter on a measure | number filter on a column *(inference: pre-aggregation)* | range filter on a column | yes (metric filters) | yes (measure filter → HAVING) | no |
| Change measure/breakdown | SQL variable (table var, time grouping) | Jinja | parameter in SQL | `parameter` + Liquid | no (drill-by only, unsaved) |
| URL | `?name=v&name=w` | `native_filters=<rison>` | in URL | in URL | `?period=…&store=a&store=b` |
| Schedule values | dashboard defaults; per-subscription override Pro/EE | stored in `extra.dashboard.nativeFilters` | per delivery, cannot add | per schedule (Filters tab), cannot add | n/a (801) |

## 8. Parameter types against our model

| Type | How the tools express it | Compiles to Cube as | Risks | Fit |
|---|---|---|---|---|
| **Member list** (store, city, region, channel; country) | A multi-select filter bound to a field per card (all four) | `filters: [{member, operator:"equals", values}]`, which is exactly v1 (`AnalyticsQueryCompiler.cs:290-299`) | A large list (stores) gives a large `IN`; 50-value pickers already. Binding by key fails silently when a view lacks the dimension (dropped, `:166-171`). Fine for a board filter, but a *required* parameter that silently drops may mislead. | **High: it is v1.** Open: should an author be able to declare *which* lists a report shows, and pin values? |
| **Date range incl. relative** ("yesterday") | Relative date filter (Metabase, Looker, Lightdash `inThePast`); Lightdash `today` default | Explicit `dateRange [from,to]` after SIS.Api resolves the token (`:283-287`) | Previous-period semantics (`AnalyticsPeriods.cs:36-40`); percentile 92-day cap → 407 (`:220-229`) when a viewer widens it. A scheduled run must resolve "yesterday" at *run* time, not save time. | **High: it is v1.** The owner's example needs only the `yesterday` token, which exists. |
| **Numeric threshold on a measure** ("cancellation rate > 5%", "stores with > 100 orders") | Looker measure filter (HAVING); Lightdash metric filter; Metabase number filter (on a column); Superset range filter | `filters: [{member: <measure>, operator: "gt", values:["0.05"]}]` → HAVING [C3] | **New compiler work:** the compiler today emits `equals` on categories only. A threshold changes *which rows* return, so `total`/`truncated` change meaning. A rate threshold on a breakdown is ok; on a KPI (no breakdown) it filters the single row out (an "empty" panel). Unit: shares are 0–1, the UI shows %. | **Medium.** Clean in Cube; needs a typed operator and unit handling, and per-panel binding to *one* measure, not by key. |
| **Top N** | Row limit on a tile; Looker/Metabase via SQL `LIMIT {{n}}` *(inference)* | `order` by the measure desc + `limit: N` | Correct only when each row is one series (`:209-214`); with date or a 2nd dimension, top N "series" needs a rank query (two `/load`s or Tesseract `rank`). N > 10,000 is refused (`:206-208`). Changing N changes the cache key. | **Medium for the single-breakdown case** (v1 already has `chart.topN`); low for per-series over time. |
| **Choice of measure** | Looker `parameter` + `{% if %}` dynamic measure; Lightdash parameter in metric SQL; Metabase/Superset via SQL templating | Swapping `measures[]` keys from an author-declared allowlist | One-view rule (`:113-115`): every option must come from the panel's view; shape table (`:173-176`): a rate cannot replace an additive in a stacked/donut chart; percentile options inherit the 92-day cap; colour-slot map and title change with the measure. The AI composing must emit only listed options. | **Medium-high** if each option is validated at save time against the chart. |
| **Choice of breakdown** | Looker `parameter` dynamic dimension; Metabase time grouping parameter; Superset time grain filter; Lightdash date zoom | Swapping a `dimensions[]` key or the `grain` | A breakdown with many members (store) multiplies rows → 10k cap, `truncated`; series cap 5 + Other; the view must expose the dimension; heatmap/table dimension counts. | **Medium-high**; grain (day/week/month) is the lowest-risk case and mirrors Metabase/Lightdash. |

**What the AI composes** *(inference)*: the AI writes structured queries only. So a parameter it declares should be
a value in the same JSON, a typed reference in place of a literal, never text spliced into SQL. Everything the tools
do with Liquid or Jinja is exactly what the standing constraints forbid. Our allowlist form is the safe subset of
Looker's `allowed_value`.

## 9. Open questions and observations (not decided here)

**For 797 (what an author may declare, and how it binds):**
- **One strip or two?** In every tool, filters and shape-changing parameters live side by side, and Lightdash keeps
  them apart: parameters cannot be mapped per tile. The map expects v1's six board filters to *become* the built-in
  parameters. That fits member lists and the period. It fits a measure choice or a threshold less well, because
  those bind to one panel's member, not to a dimension key.
- **Binding by key or explicit per panel?**
  - v1 binds implicitly by dimension key, and drops the filter silently where it does not apply.
  - All four tools also let the editor map a filter to a *different field* on a given card.
  - A cross-area report (799) may need explicit per-panel mapping, for example a store filter mapped onto two
    views' store members.
- **Required and default.** Lightdash forbids the pair and Metabase demands it. For scheduled email, a required
  parameter with no default cannot run unattended. Looker blocks saving such a schedule.
- **Linked filters.** v1 has none: city → store is not narrowed. Is it in v2's scope?
- **Threshold and top N** need compiler changes: measure filters and operators. Top N per series needs either two
  queries or the preview Tesseract planner. Decide whether either type is v2 at all.
- **Validation time.** A measure or breakdown choice should be validated for every allowed value when the report is
  saved, so a viewer never meets a 406 the author could have caught.

**For 798 (the analytics store and item shape):**
- **Where values live.** The declared parameters, their defaults, any per-panel binding and the saved values all
  change the item definition and the `Analytics/Query` input (`AnalyticsQueryRequest`, `AnalyticsWire.cs:121-138`).
  Today `period` and `filters` are the only overrides.
- **Revisions.** Is a parameter set part of a revision? Lightdash saves parameter values with the chart *and* with
  the dashboard, and the dashboard wins.

**For 801 (scheduled delivery):**
- **Value per schedule.** Every tool keeps values per schedule, edits only the inputs that exist, and gives every
  recipient the same values. Lightdash and Looker do this in the open tier; Metabase needs Pro.
- **Relative tokens.** A schedule must keep the *relative* token, so "yesterday" means the run day's yesterday.
  v1's server-side resolution already gives this.
- **Drift.** When a parameter is removed from a report, Superset now deactivates the schedule and emails the owner.
  Looker treats a new filter as "any value". Pick one rule.

**Observations:**
- **The owner's "two order types".** HungerStation is a channel group, and QC is not one in v1. The mart has a
  private `document_type`. Either way this is a model change (796), not a parameter type.
- **Cube errors.** A threshold or top N parameter adds new Cube error paths, such as a bad operator on a measure.
  These must go through the same mapping and scrubbing as 756.

## Sources

**Local (read 2026-11-06)**
- `.issues/793-…-map.md`, `.issues/766-hq-self-service-analytics-v1-spec.md` §C (lines 281-353) and stories 20-25
  (lines 112-117); `.issues/756-…` items 3, 6 and 7; `docs/adr/0006-…`; `docs/research/741-v1-semantic-model.md`.
- `src/core/models/analytics.ts:75-264`; `src/features/analytics/boards/{board.ts, effective-query.ts, periods.ts,
  permalink.ts, api.ts}`.
- BackOffice:
  - `Sartawi.Retail.Data/Modules/Analytics/AnalyticsQueryCompiler.cs`;
  - `…/AnalyticsPeriods.cs`;
  - `…/AnalyticsWire.cs:51-138`;
  - `…/AnalyticsCubeClient.cs:162-172`;
  - `Analytics/cube/cube.js`;
  - `Analytics/cube/model/cubes/orders_daily.yml`;
  - `Analytics/cube/model/views/channel_orders.yml`.
  - A grep of `Analytics/cube` for `FILTER_PARAMS|COMPILE_CONTEXT|SECURITY_CONTEXT|securityContext|queryRewrite|contextToAppId`
    found no hits.

**Cube**
- [C1] Context variables: https://docs.cube.dev/reference/data-modeling/context-variables
- [C2] Security context: https://docs.cube.dev/docs/data-modeling/access-control/context
- [C3] REST query format: https://docs.cube.dev/reference/core-data-apis/rest-api/query-format
- [C4] Configuration options: https://docs.cube.dev/reference/configuration/config
- [C5] Measures (multi-stage, Tesseract flag): https://docs.cube.dev/docs/data-modeling/measures
- [C6] Multi-stage calculations: https://cube.dev/docs/product/data-modeling/concepts/multi-stage-calculations

**Metabase**
- [M1] Dashboard filters: https://www.metabase.com/docs/latest/dashboards/filters
- [M2] SQL parameters: https://www.metabase.com/docs/latest/questions/native-editor/sql-parameters
- [M3] Basic SQL variables: https://www.metabase.com/docs/latest/questions/native-editor/basic-sql-parameters
- [M4] Optional variables: https://www.metabase.com/docs/latest/questions/native-editor/optional-variables
- [M5] Linked filters: https://www.metabase.com/docs/latest/dashboards/linked-filters
- [M6] Public links (URL params): https://www.metabase.com/docs/latest/embedding/public-links
- [M7] Subscriptions: https://www.metabase.com/docs/latest/dashboards/subscriptions

**Superset**
- [S1] Source:
  - https://github.com/apache/superset/blob/master/superset-frontend/src/constants.ts
  - https://github.com/apache/superset/blob/master/superset-frontend/packages/superset-ui-core/src/query/types/Dashboard.ts
  - https://github.com/apache/superset/blob/master/superset-frontend/src/dashboard/components/nativeFilters/FiltersConfigModal/FiltersConfigForm/FilterScope/utils.ts
  - https://github.com/apache/superset/blob/master/superset-frontend/src/dashboard/components/nativeFilters/FilterBar/state.ts
- [S2] SQL templating: https://github.com/apache/superset/blob/master/docs/admin_docs/configuration/sql-templating.mdx
- [S3] Native filter defaults: https://github.com/apache/superset/blob/master/docs/admin_docs/configuration/mcp-server.mdx
- [S4] PR #38715: https://github.com/apache/superset/pull/38715
- [S5] Issue #39709: https://github.com/apache/superset/issues/39709

**Lightdash**
- [L1] Dashboard filters: https://docs.lightdash.com/explore/dashboards/filter
- [L2] Parameters: https://docs.lightdash.com/semantic-layer/parameters
- [L3] Scheduled deliveries: https://docs.lightdash.com/explore/create-scheduled-deliveries

**Looker**
- [K1] `parameter`: https://docs.cloud.google.com/looker/docs/reference/param-field-parameter
- [K2] Templated filters and Liquid parameters: https://docs.cloud.google.com/looker/docs/templated-filters
- [K3] Dashboard filters: https://docs.cloud.google.com/looker/docs/filters-user-defined-dashboards
- [K4] Scheduling dashboards: https://docs.cloud.google.com/looker/docs/scheduling-and-sending-dashboards
