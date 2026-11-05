---
type: wayfinder-map
status: open
---

# 741 — Self-service analytics with AI: assembling the stack over the replica

## Destination

The pieces are chosen and the build can start. That means two things exist:
- an **ADR** naming the semantic layer, the BI tool, how marts are built on or beside the replica,
  and how the AI reaches them;
- a **`ready` v1 spec**: the first subject areas, AI-generated queries and views, and saved views
  that users can re-run.

Both are handed to `/to-tickets`. IT has approved the hosting. No decision blocks the build.

## Notes

**Charting rulings (owner, 2026-11-03):**
- **Destination:** the stack ADR plus a ready v1 spec. The stack is not built inside this map.
- **Separate from the pitch.** This effort is not part of the pitch
  ([The super OMS pitch](717-the-super-oms-pitch-map.md), about 2026-12-03). The pitch may show it
  only as a roadmap item. Spec 734's copilot stays the pitch's AI moment.
- **On-prem only.** Every analytics piece runs on our servers. The only outbound call is the model
  call, and it is masked and switchable exactly as in
  [Ask the OMS](734-ask-the-oms-copilot-and-mcp-tools-spec.md) (D3, D4, D9).
- **v1 users are HQ only** (executives and analysts). Every grant holder sees all stores. There is
  no row-level security in v1.
- **The source is the production read replica:** `172.23.27.47` / `POS` (`DWPOSREPL03`), a
  transactional-replication subscriber that answers only on the corporate network.
  - Facts about it are in BackOffice memory: `reference_pos_replica_readonly_door` and
    `reference_replica_retailtrxdetail_sales_analysis`.
  - `RetailTrx` (about 463M rows) and `RetailTrxDetail` (about 1.0B rows) carry NCCI columnstore
    indexes. A full-year aggregate takes 1–2 minutes.
  - The replica has no publisher NC indexes and is missing some tables, for example
    `LoyCustomerFirstPurchase*`.
  - It runs **SQL Server 2019** (15.0.4470.1, Enterprise; measured 2026-11-04). Both spikes ran on
    2022, so the build pins compatibility level 150 and smoke-tests on 2019.
- **Assemble, don't build.** We adopt existing open-source or licensed pieces. We write only the
  glue: the semantic model, the AI tools and the integration with oms-react. A hand-rolled query
  engine or BI tool is out of scope.

**Standing constraints carried from spec 734:**
- No personal data reaches the model. The semantic model must not even *declare* a PII member:
  name, mobile, email, national ID or iqama, address, coordinates, or a diagnosis.
- The model never writes raw SQL. It writes only structured queries that the catalogue validates.
- Every AI call is audited.

**Skills:**
- Research tickets use `/research`. Notes go in `docs/research/741-*.md` and are linked from the
  ticket, never pasted in.
- Grilling tickets use `/grilling`. Settle the minor points yourself as a decision list the owner
  can overrule (feedback memory).
- Use `/domain-modeling` for new terms. Expect these: semantic model, measure, dimension, view,
  saved view.

**Where the code is:**
- The web half is here.
- The server half is BackOffice (`C:\Work\DMSCO\BackOffice`), which is read-only from this map.
- Queries against the replica go through the one sanctioned PowerShell `sqlcmd` shape in the
  replica memory. Run `Test-NetConnection` first.

## Decisions so far

<!-- the index — one line per resolved ticket -->

- [What analytical load can the replica carry, and where may derived tables live?](742-what-analytical-load-can-the-replica-carry-and-where-may-derived-tables-live.md)
  — Nothing goes inside `POS`. The marts live in a sibling DB on `DWPOSREPL03` or on a separate
  on-prem server. Direct query is fine only on the columnstore till tables, over short windows. The
  edition (Resource Governor) is unknown. `Callout*` is probably not replicated. The measurements
  are owed by
  [The owner runs the replica headroom probe and the DBA answers its checklist](750-the-owner-runs-the-replica-headroom-probe-and-the-dba-answers-its-checklist.md).
- [Which on-prem BI tool lets an AI create views that users save and re-run?](744-which-on-prem-bi-tool-lets-an-ai-create-views-that-users-save-and-re-run.md)
  — First choice is **Metabase**: open source to start, with Pro budgeted for JWT SSO and
  interactive embedding. Second is **Superset**: free, but no RTL, no version history, and its
  SQL Server driver needs work. Lightdash, Evidence and PBIRS are ruled out. The BI tools' own AI
  stays off. Later tickets overtook the rest: 747 and 754 made exploring native, and 746 and 755
  moved Metabase out of the v1 path. So the spike of its unrun claims was ruled out of scope (see
  Out of scope).
- [Which on-prem semantic layer gives an AI a governed query interface over SQL Server?](743-which-on-prem-semantic-layer-gives-an-ai-a-governed-query-interface-over-sql-server.md)
  — **Cube Core**, self-hosted: Apache-2.0, an official read-only MSSQL driver, and a JSON `/load`
  query the 734 tool validates. Its rollups live in Cube Store on our own host, never in `POS`.
  The fallback is SSAS Tabular, worth it only if Excel or Power BI becomes primary. MetricFlow
  (no SQL Server), Malloy, Lightdash and Wren AI are out. 746 must make Cube and Metabase one
  governed path.
- [Which subject areas, measures and questions does v1 answer?](745-which-subject-areas-measures-and-questions-does-v1-answer.md)
  — v1 has four areas, ranked: till sales, orders by channel, delivery speed, then callouts and
  donor requests.
  - Delivery speed comes from `SdDocumentLog` first events. That corrects 723.
  - Callouts and donors wait on
    [The DBA adds the callout and donor-request tables to the replica publication](753-the-dba-adds-the-callout-and-donor-request-tables-to-the-replica-publication.md).
  - Fifteen HQ questions seed the evaluation set.
  - Nothing per customer, member or staff member, and no revenue.
  - 734's aggregate tools share these definitions.
  - The catalogue is in [741-v1-semantic-model.md](../docs/research/741-v1-semantic-model.md).
- [Do users explore inside oms-react or inside the BI tool?](747-do-users-explore-inside-oms-react-or-inside-the-bi-tool.md)
  — **Native**, and **v1 costs nothing in licences**. HQ users explore in our own oms-react screens
  (a new `analytics` area at `/analytics`, drawn with DMSCO-themed components). *(Its engine half is
  overtaken: 746 made Cube the v1 engine and the owner removed Metabase from v1 on 2026-11-05.)*
  As first settled, **Metabase OSS, the free edition**, was the engine behind them, reached over its REST API (`/api/dataset`, `/api/card`),
  with SIS.Api proxying a service credential so there is one login and no per-seat fee. No embedding
  SDK, no iframe. Pro is **not** bought for v1 — only revisited later as an optional power-user tier
  that embeds Metabase's own explorer. Native keeps the zero-literal/RTL/DMSCO rules in force (we
  render everything) and allows drill-through into the underlying OMS record. Viable because v1 is
  curated (745), not open-ended self-serve. AGPL-safe: stock jar, REST at arm's length, internal
  use, frontend never copied. Settled: a `BackOfficeScreen` grant, `/analytics/*`, and `create_view`
  routes to `/analytics/view/:id`. Proven by a five-variant prototype on branch
  `prototype/747-embedded-bi` (screenshots in `.issues/assets/747-shots/`).
- [Does embedded Superset beat native over Metabase OSS for HQ exploring?](754-does-embedded-superset-beat-native-over-metabase-oss-for-hq-exploring.md)
  — No. **Native stands and widens to full authoring:** edit chart, edit dashboard layout,
  per-panel actions (fullscreen, table, download, drill, share) and customization, all inside the
  semantic model. SQL and arbitrary joins stay out. Superset is heavy in production, its editing
  blanks when embedded, and it stays LTR under Arabic. Owner chose this about 6–8 week path.
  Prototype is the `superset` variant on `prototype/747-embedded-bi`.
- [What can an HQ user author natively, and who may edit which board?](755-what-can-an-hq-user-author-natively-and-who-may-edit-which-board.md)
  — There are three tiers: **Personal, Shared and Certified**.
  - Editing an item you may not edit makes your copy. Only a **curator grant** certifies, and AI
    views land Personal.
  - **Our store is the record**: definitions are in semantic-model terms, with revisions (last 20)
    and revert. Metabase only runs `/api/dataset`. This amends 747's card landing.
  - There are **eight chart types** (KPI, line, area, bar, donut, table, heatmap, combo). Map and
    pivot come later.
  - Panels have fullscreen, table, download, drill by and permalink. Drill to detail hands off to
    OMS screens and never shows raw rows.
  - Boards use a 12-column grid with board filters, cross-filter and relative periods.
  - Boards have auto-refresh (30 s floor provisional on 750, with a server cache) and TV-mode
    fullscreen.
- [How does the AI generate queries and views within spec 734's tool catalogue and MCP?](746-how-does-the-ai-generate-queries-and-views-within-spec-734s-tool-catalogue-and-mcp.md)
  — Three new tools join 734's one D1 registry: `describe_model` and `semantic_query` (read-only),
  and `create_view` (writes a definition to **our** store as Personal, per 755 — never a Metabase
  card, never the OMS).
  - **One governed path:** **Cube is the v1 query engine** (declares the model once, validates,
    serves pre-aggregations); **Metabase is retained but not in the v1 path** — only the later Pro
    embed tier's engine. The stored definition and the SIS.Api compiler are engine-neutral, which is
    how "Cube + Metabase" stays one path without forking the engine.
  - D2's three aggregate tools **stay as specified for the pitch**, then re-point to `semantic_query`
    at parity (one definition, no drift).
  - **Masking by construction** (no PII member is declared in Cube) + the D3 scrubber backstop; a
    drill hands off to an OMS screen and never shows raw rows.
  - Per-query **30 s / 10,000-row** cap (ratified by 750) in the existing trace.
  - The **panel is the AI way in**, plus an inline ask on `/analytics`; **MCP stays read-only**
    (`create_view` is panel-only, amending D1 with per-tool surface tags). D4 unchanged; **D14
    extends** with 745's fifteen questions and a scoring rule (right measures/dimensions/filters,
    no invented number, a chart type that fits the shape). AI creates **views, not boards**.
- [What builds the marts: views on the replica, dbt into a sibling database, or a copy to a columnar store?](748-what-builds-the-marts-views-on-the-replica-dbt-into-a-sibling-database-or-a-copy-to-a-columnar-store.md)
  — The owner settled it provisional on 750: **dbt into `POS_Analytics`**, a sibling DB on
  `DWPOSREPL03`. It overrules a Cube-Store-only recommendation.
  - **The marts:** daily marts per area, plus `fct_delivery`, one row per delivery.
  - **Percentiles** are computed exactly per query over `fct_delivery`, and capped at 92 days.
  - **Refresh:** every 15 minutes for today, and the last 3 days nightly. The swap is atomic, and a
    failed run keeps the last good data.
  - **Ownership:** the dev team owns the project in BackOffice `Analytics/`, and its scheduler runs
    on the analytics host. The DBA owns the DB and two `svc_analytics_*` logins.
  - **Reinit:** the marts survive it; afterwards the outage days are rebuilt.
  - **`sales_summary`:** the till mart *is* 734's rollup; 3346's own copy retires at parity.
  - **Fallback**, if the sibling DB is refused: a separate SQL Server, then Cube Store.
  - Its proof is
    [A local spike proves dbt-sqlserver builds incremental marts into a sibling database](757-a-local-spike-proves-dbt-sqlserver-builds-incremental-marts-into-a-sibling-database.md).
- [A local spike proves Cube Core answers a governed /load over SQL Server](756-a-local-spike-proves-cube-core-answers-a-governed-load-over-sql-server.md)
  — **Cube Core passes all seven items**, so the ADR may name it, and SSAS is not reopened. It ran
  v1.8.18 locally against SQL 2022, over a mart in `POS_Analytics`, with a reader login; the XE
  trace shows SELECTs only. It narrows 746:
  - **`public: false` refuses with a 500 only *after* the source query ran.** Masking therefore
    rests on not declaring a member at all, plus SIS.Api checking every member against `/meta`
    before `/load`.
  - **Every cube is `public: false` and only views are public.** `/meta` is then exactly the AI's
    catalogue.
  - **Cube's error statuses must be mapped and scrubbed**, never passed through.
  - **The caps:** `CUBEJS_DB_QUERY_LIMIT` and `CUBEJS_DB_QUERY_DEFAULT_LIMIT` are both 10000; a
    query with no limit is cut silently, so send `total`. `CUBEJS_DB_QUERY_TIMEOUT=30s` aborts the
    query on SQL Server itself.
  - **Trust-cert needs a `driverFactory`.** With the env vars alone, the self-signed failure
    crashes the process.
  - **Cube Store is amd64-only.**
  - **Sunday weeks need a custom granularity**, and SIS.Api resolves week ranges itself.
- [A local spike proves dbt-sqlserver builds incremental marts into a sibling database](757-a-local-spike-proves-dbt-sqlserver-builds-incremental-marts-into-a-sibling-database.md)
  — **dbt passes all seven items, so 748's choice stands** and neither the SQL Agent nor the Cube
  Store fallback is reopened. It ran dbt-core 1.12.6 with `dbt-sqlserver[pyodbc]` 1.12.2 against
  SQL 2022 locally, over a synthetic `POS` of 1.0M log events, with the dbt login reader-only on
  `POS`. It narrows the build:
  - **The built-in `delete+insert` swaps a day in one transaction.** Killed mid-swap, every
    committed reader saw the old day. A NOLOCK reader saw a ~5 ms gap, so **`POS_Analytics` runs
    with RCSI on and nothing reads the marts with NOLOCK**.
  - **Nothing is written to `POS`.** 107 statements read it and none write; every dbt object lands
    in `POS_Analytics`. The engine does auto-create statistics on POS from the reads, a DBA note
    for 749.
  - **`fct_delivery` and the percentiles:** 234k deliveries build in 2.3 s. The 92-day p50 and p90
    by store over 1.43M rows take 1.6–2.4 s, inside the 30 s cap, and `PERCENTILE_CONT` is
    bit-identical to `DispatchScorecardMath.Percentile`. Cube's login is capped at `MAX_DOP` 4 or
    less, since unbounded parallelism triples the CPU.
  - **`dbt build` ignores freshness.** The job script runs `dbt source freshness` first and is
    the fail-closed gate: a stale source exits 3 with no swap and a logged row. Freshness also needs
    a UTC override, because POS writes Riyadh local time.
  - **The load-log post-hook commits with the swap.** Failures are logged on-run-end with autocommit.
  - **The scheduled container** is a pinned Python image of 426 MB with an 8–11 s cold job. Its
    fixed container name is the overlap guard.

- [IT approves the on-prem hosts and service logins for the analytics stack](749-it-approves-the-on-prem-hosts-and-service-logins-for-the-analytics-stack.md)
  — **Approved 2026-11-04.** The owner speaks for IT and is acting DBA.
  - **The host:** a **Docker host VM on Nutanix AHV** (Linux amd64, 8 vCPU / 32 GB / 150 GB), not
    Kubernetes. It has an internal-CA certificate and no internet egress, and only SIS.Api reaches
    it, on 443. The request is in [741-nutanix-infra-request.md](../docs/research/741-nutanix-infra-request.md).
  - **Built and verified on the replica:** `POS_Analytics` (compat 150, RCSI, `SIMPLE`, 40 GB cap,
    `MAXDOP` 4), and both `svc_analytics_*` logins with exactly their grants.
  - **No Resource Governor in v1.** SQL TLS uses an internal-CA certificate. Host names and IPs are
    build inputs.
- [Recharts for the native analytics charts](../docs/research/741-recharts-for-native-charts.md)
  (research note, owner confirmed 2026-11-05) — **Recharts 3, pinned**, is the chart renderer,
  behind one wrapper that owns RTL (`dir="ltr"` box + mirrored props), `--chart-1…5` tokens,
  colour by entity and streaming per-panel loading feedback. Prototype commits `244a080c` and
  `01286f77` on `prototype/747-embedded-bi`.
- **Hand-off (2026-11-05):** [ADR 0006](../docs/adr/0006-analytics-is-native-screens-over-cube-and-dbt-marts.md)
  and the `ready` spec
  [HQ self-service analytics v1](766-hq-self-service-analytics-v1-spec.md). The spec settles the
  last fog (Cube and SIS.Api caching, bilingual model labels, who changes the model). 750 and 753
  stay open as confirmations and as the gate for area 4, not as blockers.
  Sliced the same day: web tickets 767–784 (Slice 0 = 767), and the server half filed as
  BackOffice spec 3378 with tickets 3379–3385.

## Not yet specified

Nothing left. The spec settled the last patches (caching, Arabic labels, model governance) on
2026-11-05.

## Out of scope

- **Row-level security for regional or store managers.** v1 is HQ only (ruling 2026-11-03). Adding
  it later is a new effort.
- **Cloud warehouses or cloud BI.** Everything stays on-prem (ruling 2026-11-03).
- **Any demo for the pitch.** That belongs to [The super OMS pitch](717-the-super-oms-pitch-map.md).
- **Building a query engine, semantic layer or BI tool from scratch.** We assemble existing pieces.
- **Customer-level analytics on personal data.** No PII member exists in the semantic model.
- **Metabase sign-on, and Metabase anywhere in v1** (owner ruling 2026-11-05). Cube is the v1 engine
  (746) and our own screens draw everything, so no user ever signs in to Metabase. Users sign in once,
  to oms-react. SIS.Api reaches Cube with a service credential, and the D6 audit records the acting
  user. The optional Pro embed tier would be a new effort.
- **Building the stack.** That is `/to-tickets`' job after the spec.
- **A spike of Metabase and Superset view-creation by API and of their Arabic UI**
  ([A local spike proves Metabase and Superset create a structured view by API and render Arabic](752-a-local-spike-proves-metabase-and-superset-create-a-structured-view-by-api-and-render-arabic.md),
  closed 2026-11-04, never run). 754 rejected Superset. 755 and 746 took Metabase cards, MCP and
  the Metabase query path out of v1. 747's native exploring makes the BI tool's own RTL irrelevant.
  The job of proving claims before the ADR moved to
  [A local spike proves Cube Core answers a governed /load over SQL Server](756-a-local-spike-proves-cube-core-answers-a-governed-load-over-sql-server.md).
