# 741 / 743 — Semantic layer options over SQL Server 2019 (on-prem)

> Research for [Which on-prem semantic layer gives an AI a governed query interface over SQL Server?](../../.issues/743-which-on-prem-semantic-layer-gives-an-ai-a-governed-query-interface-over-sql-server.md).
> Written **2026-11-03**. Sources are primary (vendor docs, GitHub source, licence files, the
> GitHub API for release and licence data, all read today). The URL is given inline with each claim.
> **[unverified]** marks anything I could not confirm from a primary source.
>
> Constraints carried from [map 741](../../.issues/741-self-service-analytics-with-ai-map.md) and
> [742's note](741-replica-headroom-and-derived-tables.md):
> - on-prem only;
> - the model never writes raw SQL, only structured queries the catalogue validates;
> - no PII member is even declared;
> - nothing is written into `POS`;
> - `RetailTrx` has about 463M rows and `RetailTrxDetail` about 1.0B, both on NCCI columnstore, and
>   a full-year aggregate takes 1–2 minutes;
> - the edition is unknown and may be Standard.

---

## Bottom line

**Cube Core is the only candidate that meets every hard constraint off the shelf.**
- **Open source:** Apache-2.0, self-hosted, v1.8.18 released today.
- **SQL Server driver:** an official one that is **read-only by default**.
- **Structured query:** a JSON query (`measures`, `dimensions`, `filters`, `timeDimensions` with
  `granularity`). This maps one-to-one onto a validated tool in spec 734's catalogue.
- **Pre-aggregations:** built by bounded, partitioned `SELECT … GROUP BY` against the source.
  They are stored in **Cube Store**, Cube's own engine, on its own host, so nothing is written to
  `POS`.
- **Weaknesses:**
  - Power BI and Excel get only the Postgres-wire SQL API on Core. The native DAX API is a Cube
    Cloud product.
  - The official MCP server is a Cube Cloud product. We would wrap REST `/load` in our own SIS.Api
    tool, which spec 734 wants anyway.

**The runner-up is SSAS Tabular**, the Microsoft-native option.
- It may already be paid for with the SQL Server licence.
- Excel and Power BI connect to it natively, and it has RLS in Standard.
- But it speaks DAX/MDX, not a structured query, so our glue must compile structured → DAX.
- Standard edition caps it at **16 GB** and **one partition per table**. That forces it onto a
  pre-aggregated mart, never the 1B-row detail table.

**Disqualified:**
- **dbt MetricFlow:** no SQL Server dialect, and its query APIs are dbt-Cloud-only.
- **Malloy:** its SQL Server dialect is a month-old experiment.
- **Lightdash:** no SQL Server.
- **Wren AI:** the model writes SQL, and RLS/CLS are commercial.
- **Boring Semantic Layer:** too young, with no cache.
- **Metabase and Superset:** they are BI tools whose "semantic layers" are tied to the tool and
  have no pre-aggregation on SQL Server. They belong to ticket 744 as *consumers*, not to this
  ticket as *the layer*.

---

## Comparison

| | **Cube Core** | **SSAS Tabular 2019** | dbt MetricFlow (OSS) | Malloy | Metabase (OSS) | Superset | Lightdash | Wren AI (OSS) |
|---|---|---|---|---|---|---|---|---|
| SQL Server | **Official driver** `mssql`; read-only default | **Native** (same product family) | **None** (no dialect; adapter refused) | **Experimental** (merged 2026-10-02) | Official driver | SQLAlchemy driver | **Not supported** | pyodbc connector |
| Licence / self-host | Apache-2.0 (client MIT); fully self-hosted | Licensed with SQL Server Std/Ent | Apache-2.0 (since 0.209); APIs Cloud-only | MIT | AGPL (+ commercial EE) | Apache-2.0 | MIT (+ `ee/`) | Apache-2.0 core; RLS/CLS/UI commercial |
| AI query shape | **JSON** measures / dims / filters / timeDimensions | DAX / MDX text | `mf query --metrics … --group-by …` (CLI only) | Malloy language | MBQL JSON (`execute_query`) | `query_dataset` / `generate_chart` | — | **SQL** over the MDL |
| MCP | Official one is Cloud; wrap REST ourselves | MS Power BI Modeling MCP (preview, DAX) | dbt-mcp (SL tools need dbt platform) | Publisher/MCP (docs PR) | **Built-in, all plans** | **Built-in** (Superset 5.0+, "Next" docs) | — | Built-in (`mcp_server.py`) |
| Pre-aggregation | **Rollups in Cube Store** (separate host) | VertiPaq import on the SSAS host | Cloud-only cache, stored in the warehouse | None | Model persistence: **not on SQL Server**; result cache in app DB | None (results cache) | — | None |
| Hide a member | Don't declare it; `public: false`; `member_level` policies | Don't import it; OLS **[unverified]** | — | — | Hide fields in metadata | Dataset columns | — | Paid CLS |
| RLS later | `row_level` policies (Core) | **Yes, Standard** | — | — | **Pro/Ent only** | Built-in RLS filters | — | Paid |
| BI readers | Postgres-wire SQL API (Superset, Metabase, Tableau…); Power BI SQL-API fallback only on Core | **Excel, Power BI, SSRS** native; Tableau **[unverified]** | — | — | itself | itself | — | itself |
| Verdict | **#1** | **#2** | Out | Out | BI tool (744) | BI tool (744) | Out | Out |

---

## Cube Core

**Versions and licence.** The latest release is v1.8.18, published 2026-11-03T13:47Z (GitHub API,
`repos/cube-js/cube/releases/latest`). The licence is mixed:

> "covered by one of two licenses: (i) the Apache License 2.0 (ii) an MIT license. The default …
> is Apache License 2.0"

(source: [LICENSE](https://github.com/cube-js/cube/blob/master/LICENSE)). The README says the
backend is Apache 2.0 and the client is MIT ([repo](https://github.com/cube-js/cube)). The MSSQL
driver package says `"license": "Apache-2.0"`, version 1.8.18
([package.json](https://github.com/cube-js/cube/blob/master/packages/cubejs-mssql-driver/package.json)).
Cube Store lives in the same repo (`rust/cubestore`) under the repo-default Apache-2.0.

The commercial Cube platform adds:
- Analytics Chat, workbooks and dashboards;
- managed deployment, RBAC and multi-tenancy;
- the Tableau, Power BI, Excel and Sheets integrations.

([repo README](https://github.com/cube-js/cube)). No relicensing has been announced.

**The SQL Server driver.** `CUBEJS_DB_TYPE=mssql` (package `@cubejs-backend/mssql-driver`). It
supports SSL and Windows auth through `trustedConnection` in a custom `driverFactory`
([docs](https://docs.cube.dev/admin/connect-to-data/data-sources/ms-sql)).

Its documented gaps:
- `count_distinct_approx` "can not be used in pre-aggregations when using Microsoft SQL Server";
- BIT booleans need explicit comparisons in SQL API pushdown;
- the pre-aggregation build strategy is **Simple only**. In the docs' words, "Microsoft SQL Server
  does not support batching" and "does not support export buckets"
  ([same page](https://docs.cube.dev/admin/connect-to-data/data-sources/ms-sql)).

The source code adds two facts:
- `readOnly()` returns `!!this.config.readOnly`, the config defaults `readOnly` to **`true`**, and
  results are streamed with `stream()`
  ([MSSqlDriver.ts](https://github.com/cube-js/cube/blob/master/packages/cubejs-mssql-driver/src/MSSqlDriver.ts)).
  The Simple strategy is marked "Read-only mode: Supported". So pre-aggregations are built by
  streaming a `SELECT` into Cube Store, with no write to the source.
- Time grains use `dateadd(day, DATEDIFF(day, 0, x), 0)`-style truncation for hour through year.
  The default row cap is `TOP 10000`
  ([MssqlQuery.ts](https://github.com/cube-js/cube/blob/master/packages/cubejs-schema-compiler/src/adapter/MssqlQuery.ts)).

Maturity: 20 open issues mention MSSQL. The relevant ones:
- [#7188](https://github.com/cube-js/cube/issues/7188): lambda pre-aggregations fail inconsistently on MSSQL;
- [#12015](https://github.com/cube-js/cube/issues/12015): rolling-window steps are wrong for quarter and week grains on the native planner;
- [#11407](https://github.com/cube-js/cube/issues/11407): an out-of-range `datetime2` makes `MIN()` return NULL;
- [#12082](https://github.com/cube-js/cube/issues/12082): an SQL API TRIM rewrite.

None of them blocks a plain rollup, but **avoid lambda rollups and rolling windows on MSSQL until
they are tested**.

**The query API.** Cube serves REST (`/cubejs-api/v1/load`, `/meta`, `/sql`), GraphQL, and a SQL
API. The SQL API is disabled by default on Core and turned on with `CUBEJS_PG_SQL_PORT`. It is
Postgres-wire-compatible and exposes each cube or view as a table
([SQL API](https://cube.dev/docs/backend/sql);
[REST query format](https://docs.cube.dev/reference/core-data-apis/rest-api/query-format)).
Members are named `cube.member`. The shape the AI would emit, which our tool validates against
`/meta`, is:

```json
{ "query": {
  "measures": ["sales.net_amount", "sales.trx_count"],
  "dimensions": ["store.city"],
  "timeDimensions": [{ "dimension": "sales.trx_date", "granularity": "month",
                       "dateRange": ["2026-01-01", "2026-09-30"] }],
  "filters": [{ "member": "sales.channel", "operator": "equals", "values": ["POS"] }],
  "limit": 500 } }
```

Custom granularities can be addressed by name in REST but not in SQL or GraphQL
([dimensions ref](https://docs.cube.dev/reference/data-modeling/dimensions.md)). Production mode
needs an HS256 JWT signed with `CUBEJS_API_SECRET`, and dev mode turns auth off and must never be
exposed ([repo README](https://github.com/cube-js/cube)).

**MCP and AI.** Cube's MCP server has 30 tools (`searchDataModel`, `runQuery`, model editing,
`buildPreAggregation`, …) and is documented as available "on all plans". But it is documented only
as a **Cube Cloud** endpoint configured in the Cube console
([docs](https://docs.cube.dev/docs/integrations/mcp-server.md)). **Whether it runs against
self-hosted Core: [unverified]; the docs imply not.** Community wrappers of `/load` exist but are
not official. The fit for us: SIS.Api's spec-734 loop calls `/meta` and `/load` itself, behind a
D1-style tool with its own DTO, scrubber (D3) and audit. That is the "glue" the map allows, and it
keeps the model connector switchable (D4).

**Caching and pre-aggregation.** There are two things to know:
- **Where pre-aggregations live.** By default they are built and stored in **Cube Store**. The
  docs say Cube "may require write access to the pre-aggregations schema in the source database"
  depending on the source
  ([pre-aggregations](https://docs.cube.dev/docs/pre-aggregations.md)), but MSSQL's Simple
  strategy supports read-only mode (above).
- **The `original_sql` type** persists into the *source* database. Never use it against `POS`.
  Point it at a sibling DB, or don't use it
  ([ref](https://docs.cube.dev/reference/data-modeling/pre-aggregations.md)).

How rollups refresh:
- `partition_granularity` (day through year, roughly ≤ 500–1,000 partitions) plus `refresh_key`
  (default every hour) plus `build_range_*`. Each partition refresh is a bounded `GROUP BY` over
  one month or one day. That is the exact load shape 742 says the columnstore tables tolerate.
- Cube "will **not** return results outside of the defined build range" (same ref).

The Cube Store cluster:
- It is one router plus N workers, with no built-in auth, so it needs an isolated network.
- `CUBESTORE_REMOTE_DIR` can be a local path if all nodes run on one machine, or S3, GCS or MinIO
  ([architecture](https://docs.cube.dev/cube-core/architecture),
  [deployment](https://docs.cube.dev/cube-core/deployment)).
- The production minimum is a Cube API instance, a refresh worker, a Store router and Store
  workers (same).

**This puts the derived data on the separate on-prem server 742 calls option (c), which is
compatible.** Cube can also read rollup tables that 748 builds in a sibling DB, as a second data
source. Docker images are the documented path, so plan a Linux/Docker host. **Windows-native Cube
Store: [unverified].**

**Access control.**
- The primary control is not declaring PII members at all, and exposing to the AI only **views**
  whose cubes are otherwise hidden.
- A member with `public: false` "**cannot** be queried through the API"
  ([dimensions ref](https://docs.cube.dev/reference/data-modeling/dimensions.md)). **Run in
  [756](../../.issues/756-a-local-spike-proves-cube-core-answers-a-governed-load-over-sql-server.md):**
  it *is* absent from `/meta`. But the refusal (HTTP 500) comes **after** the source query has run,
  so only an undeclared member keeps the load off the source.
- `access_policy` gives `member_level` (`includes` / `excludes`), `row_level` filters and
  `member_masking`. It works in Core through `context_to_groups` (or `context_to_roles`) mapping
  the JWT security context. `userAttributes` is Cloud-only
  ([access policies](https://docs.cube.dev/docs/data-modeling/data-access-policies.md),
  [reference](https://docs.cube.dev/reference/data-modeling/data-access-policies)).
- So RLS later is a model change, not a new product.

**BI readers.**
- Through the SQL API, anything that speaks Postgres: Superset, Metabase, Tableau, psql.
- **Power BI on Core gets only the SQL API**: "much more limited functionality than the DAX API",
  "the only option when using Cube Core". The DAX API (live connection, NTLM/Kerberos) is Cube
  Cloud Enterprise ([Power BI](https://docs.cube.dev/docs/integrations/power-bi.md),
  [DAX API](https://docs.cube.dev/reference/core-data-apis/dax-api)).
- **Excel:** no Core path documented. **[unverified]** whether Excel via ODBC-to-Postgres works.

**Model size** (about 10 measures and 15 dimensions). Roughly:

| File | Contents | Lines |
|---|---|---|
| `model/cubes/sales.yml` | the `RetailTrx` fact: `sql_table`, 10 measures, 6 dimensions, joins, one partitioned rollup | ~120 |
| `model/cubes/store.yml`, `item.yml` | about 9 conformed dimensions | ~60 |
| `model/views/sales_analytics.yml` | the single AI-facing surface: `includes` lists, no PII | ~30 |
| `cube.js` | `contextToGroups`, `queryRewrite` (cap and time-out guard), `driverFactory` | ~40 |

That is **4–5 files, about 250 LOC of YAML/JS.** A sketch:

```yaml
cubes:
  - name: sales
    sql_table: dbo.RetailTrx
    data_source: default
    joins: [{ name: store, relationship: many_to_one, sql: "{CUBE}.StoreCode = {store}.Code" }]
    measures:
      - { name: net_amount, sql: NetAmount, type: sum, format: currency }
      - { name: trx_count, type: count }
    dimensions:
      - { name: trx_id, sql: TrxId, type: number, primary_key: true }   # never exposed
      - { name: trx_date, sql: TrxDate, type: time }
      - { name: channel, sql: DocumentType, type: string }
    pre_aggregations:
      - name: by_store_day
        measures: [net_amount, trx_count]
        dimensions: [store.city, store.code, channel]
        time_dimension: trx_date
        granularity: day
        partition_granularity: month
        refresh_key: { every: 1 hour, incremental: true, update_window: 3 day }
```

(Column names are illustrative. They must be checked against the replica's DDL.)

---

## SSAS Tabular (SQL Server 2019 Analysis Services)

**Licence and edition.** Analysis Services is a SQL Server feature
([editions 2019](https://learn.microsoft.com/en-us/sql/sql-server/editions-and-components-of-sql-server-2019)).

What 2019 **Standard** caps:
- Analysis Services compute at the lesser of 4 sockets or 24 cores;
- **16 GB** maximum memory per instance for **Tabular** (64 GB for MOLAP) (same page).

What Tabular features **Standard** has and lacks
([features by edition](https://learn.microsoft.com/en-us/analysis-services/analysis-services-features-by-edition)):
- **Yes:** DAX and MDX queries, **row-level security**, calculation groups, in-memory mode, and
  DirectQuery (from 2019).
- **No:** **perspectives** and **multiple partitions**. Those are Enterprise only.

**Whether running SSAS on a separate server needs its own SQL Server licence: [unverified]**, but it
is believed to (check with whoever holds the licensing agreement).

**SQL Server.** Native, as the same product family.
- **Import mode** puts data in VertiPaq on the SSAS host. That is load isolation like 742's option
  (c), with processing as bulk reads from the replica or the mart.
- **DirectQuery** would push every visual's DAX down to the replica as SQL. That is the 1–2 minute
  problem again.
- On Standard, one partition per table means **every process is a full reload**, and 16 GB will
  not hold the 1.0B-row line table. So the realistic SSAS design is **import from a pre-aggregated
  mart** (748). That is an inference from the limits above, not a measured result.

**The query API.** XMLA, through ADOMD.NET / AMO / OLE DB, carrying DAX or MDX (features table
above). There is no REST and no JSON query. To meet "the model never writes raw SQL" (or DAX),
**our glue would have to compile a structured query into a templated `SUMMARIZECOLUMNS` DAX
statement**. That is small, but it is a query generator we own.

**MCP and AI.** Microsoft's [powerbi-modeling-mcp](https://github.com/microsoft/powerbi-modeling-mcp)
is in public preview. It edits models and executes and validates DAX (`dax_query_operations`). It
reaches SSAS with `--compatibility Full` plus `PBI_MODELING_MCP_ALLOWED_CONNECTION_HOSTS` (its
README). It is a *modelling* tool that lets the AI author DAX, so it **breaks** the no-raw-query
rule and is not the runtime path.

**Caching.** VertiPaq is the cache (in-memory columnar). There is no separate result cache to
configure **[unverified]**.

**Access control.**
- Don't import PII columns.
- Role-based **RLS: yes in Standard**.
- Object-level security (hiding a column or table from a role) exists in Tabular, but **its edition
  support is not in the features table: [unverified]**.

**BI readers.** Excel PivotTables, Power BI (live connection) and SSRS are native. Tableau
supports MSAS **[unverified]**. **Superset and Metabase cannot read it** (no SQLAlchemy/JDBC
semantic driver) **[unverified, but no driver found]**.

**Model size.** The same 10 × 15 model is one `.bim` (TMSL JSON) or TMDL folder, typically
**about 600–1,500 lines** of generated JSON, maintained in Visual Studio/SSDT or Tabular Editor.
It is less hand-diffable than Cube YAML. That is an estimate, not measured.

---

## dbt MetricFlow (open-source engine)

- **Licence:** "Version 0.150.0 to 0.208.2 was covered by the BSL license. Version 0.209.0 and
  greater is covered by the Apache 2.0 license." The latest release is v0.213.0, 2026-09-10
  ([README](https://github.com/dbt-labs/metricflow), GitHub API).
- **No SQL Server dialect at all:**
  - The `SqlEngine` enum is BigQuery, DuckDB, Redshift, Postgres, Snowflake, Databricks, Trino,
    Vertica, Athena and ClickHouse
    ([sql_client.py](https://github.com/dbt-labs/metricflow/blob/main/metricflow/protocols/sql_client.py)).
  - `dbt-metricflow`'s `SupportedAdapterTypes` is the same list, and any other adapter raises
    `"Adapter type … is not supported"`
    ([adapter_backed_client.py](https://github.com/dbt-labs/metricflow/blob/main/dbt-metricflow/dbt_metricflow/cli/dbt_connectors/adapter_backed_client.py)).
  - **So `dbt-sqlserver` (MIT, v1.12.2, released today) and `dbt-fabric` (MIT, v1.12.0) can build
    models on SQL Server, but MetricFlow cannot query through them.** They remain candidates for
    *building marts* (748).
- **What is cloud-only:**
  - The Semantic Layer APIs (GraphQL, JDBC/Arrow Flight and the Python SDK) require a dbt platform
    Starter, Enterprise or Enterprise+ plan
    ([API overview](https://docs.getdbt.com/docs/dbt-cloud-apis/sl-api-overview)).
  - The FAQ says "The dbt Semantic Layer is proprietary to dbt, however some components of it are
    open-source". Locally you can query from the command line but "won't be able to use the APIs
    or available integrations". Caching is Enterprise only and lives in the warehouse. The
    platforms supported are Snowflake, BigQuery, Databricks, Redshift, Postgres and Trino, and
    "Fabric, isn't available at this time"
    ([SL FAQs](https://docs.getdbt.com/docs/use-dbt-semantic-layer/sl-faqs)).
- **MCP:** [dbt-mcp](https://github.com/dbt-labs/dbt-mcp) is Apache-2.0. Its Semantic Layer tools'
  platform requirement is not stated in the README. **[unverified]**, but they ride the SL APIs
  above.
- **dbt Fusion engine licensing:** not assessed. It is irrelevant once the dialect is missing.

**Out:** no T-SQL, and no self-hostable query API.

## Malloy

- **Licence:** MIT ([LICENSE](https://github.com/malloydata/malloy/blob/main/LICENSE)). The latest
  release is v0.0.437, 2026-10-30.
- **SQL Server:** a native dialect and connection,
  [`@malloydata/db-sqlserver`](https://github.com/malloydata/malloy/tree/main/packages/malloy-db-sqlserver),
  merged **2026-10-02** in [PR #3099](https://github.com/malloydata/malloy/pull/3099):
  - It is "experimental behind `##! experimental.dialect.sqlserver`".
  - It is described as "the first, deliberately small cut … Nothing hard is in it; the hard parts
    each get their own PR afterwards". SQL Server 2017 is the floor, and a `db_datareader` login
    is enough (package README).
  - Open dialect bugs on boolean-less dialects:
    [#3171](https://github.com/malloydata/malloy/issues/3171),
    [#3168](https://github.com/malloydata/malloy/issues/3168).
- **Query shape:** the Malloy language (text), plus a query-builder package.
- **MCP:** serving to agents over MCP is in a docs PR
  ([#3096](https://github.com/malloydata/malloy/pull/3096), open).
- **No pre-aggregation layer** found **[unverified]**.

**Out:** the T-SQL dialect is a month old and incomplete.

## Metabase (models, metrics, MCP)

- **Licence:** AGPL outside `enterprise/`, which is under the Metabase Commercial License
  ([LICENSE.txt](https://github.com/metabase/metabase/blob/master/LICENSE.txt)). The latest
  release is v0.65.2, 2026-10-30.
- **SQL Server:** an officially supported database
  ([docs](https://www.metabase.com/docs/latest/databases/connections/sql-server)).
- **AI:**
  - Metabot and the MCP server are "available on all plans". Per-group tool limits are Pro/Ent
    ([AI overview](https://www.metabase.com/docs/latest/ai/overview)).
  - The MCP endpoint is `/api/metabase-mcp`. It has **`execute_query`, which takes a structured
    MBQL query ("never base64, never SQL")**, and a separate `execute_sql` gated by the
    `agent:sql:run` scope ([MCP tools](https://www.metabase.com/docs/latest/ai/mcp-tools),
    [MCP](https://www.metabase.com/docs/latest/ai/mcp)).
  - The structured query uses numeric table and field ids, and the model lives in Metabase's
    application DB, not in Git.
- **Pre-aggregation:**
  - Model persistence works "only … for" PostgreSQL, MySQL and Redshift, so **not SQL Server**. It
    writes into the source warehouse, and per-model persistence is Pro/Ent
    ([model persistence](https://www.metabase.com/docs/latest/data-modeling/models/model-persistence)).
  - Result caching is stored in the app DB. Duration, schedule and per-item policies are Pro/Ent
    ([caching](https://www.metabase.com/docs/latest/configuring-metabase/caching)).
- **RLS:** row and column security is "only available on Pro and Enterprise plans"
  ([docs](https://www.metabase.com/docs/latest/permissions/row-and-column-security)).

**Not the layer:** it has no pre-aggregation on SQL Server, and the model is locked in the BI tool.
**It is a strong 744 candidate as a reader of Cube** (through the SQL API) or of the marts directly.

## Apache Superset (datasets, metrics, semantic views)

- **Licence:** Apache-2.0. The latest release is 6.1.0, 2026-05-13.
- **MCP:** a built-in MCP server (`list_metrics`, `get_compatible_dimensions`, `query_dataset`,
  `generate_chart`, `execute_sql`, …). `MCP_DISABLED_TOOLS = {"execute_sql"}` removes raw SQL. It
  has JWT auth and RBAC. The page is labelled "Next" (unreleased docs), with Superset 5.0+ as the
  prerequisite ([MCP docs](https://superset.apache.org/admin-docs/configuration/mcp-server)).
- **Semantic views:** "semantic views" from an *external* semantic-layer provider are being built
  as an extension behind the `SEMANTIC_LAYERS` flag
  ([Preset recap, May 2026](https://preset.io/blog/apache-superset-repo-recap-may-2026/), a
  secondary source).
- **SQL Server:** through a SQLAlchemy driver (pymssql/pyodbc). **[unverified]**: the docs page
  returned 404 today.

**Not the layer:** a dataset's metrics are thin, and there is no pre-aggregation. **It is a 744
candidate, and the only one heading toward consuming an external semantic layer natively.**

## Lightdash

- It is MIT outside `packages/backend/src/ee`
  ([LICENSE](https://github.com/lightdash/lightdash/blob/main/LICENSE)).
- Its supported warehouses are BigQuery, Postgres, Supabase, Redshift, Snowflake, Databricks, Trino,
  ClickHouse, DuckDB and Athena. **No SQL Server**, only a "may" through Trino
  ([docs](https://docs.lightdash.com/get-started/setup-lightdash/connect-project)).

**Out.**

## Wren AI

- **Licence:** Apache-2.0 for `core/`, `sdk/`, `skills/` and `examples/`, CC-BY for docs, and an
  AGPL text "pre-emptively" included for future modules
  ([LICENSE](https://github.com/Canner/WrenAI/blob/main/LICENSE)).
- **wren-engine:** **archived 2026-05** and merged into WrenAI `core/`
  ([wren-engine](https://github.com/Canner/wren-engine)).
- **SQL Server:** a native pyodbc connector
  ([mssql.py](https://github.com/Canner/WrenAI/blob/main/core/wren/src/wren/connector/mssql.py)).
- **Query shape:** the agent "writes governed SQL" over the MDL (`wren query --sql '…'`).
- **Commercial-only:** "Row- and column-level security", the "GenBI UI, dashboards, embedded and
  APIs", and audit are Wren Cloud or Enterprise Plus
  ([README](https://github.com/Canner/WrenAI)).

**Out:** the model writes SQL, which breaks spec 734's rule, and the governance features are paid.

## Boring Semantic Layer

- MIT, v0.3.18. It is Ibis-based, so SQL Server is reachable through Ibis's MSSQL backend.
- Its measures and dimensions are Python lambdas, and it is pitched as "MCP-friendly"
  ([README](https://github.com/boringdata/boring-semantic-layer)).
- No caching, pre-aggregation or access policies were found **[unverified]**.

**Out:** pre-1.0, and no pre-aggregation for 1B rows.

---

## Disqualified and why

1. **dbt MetricFlow:** no SQL Server engine. Unsupported adapters raise an error, and the query
   APIs require dbt platform.
2. **Malloy:** its SQL Server dialect is experimental, released 2026-10-02, and "nothing hard is in
   it".
3. **Lightdash:** no SQL Server warehouse.
4. **Wren AI:** the AI writes SQL, and RLS/CLS, UI, APIs and audit are commercial.
5. **Boring Semantic Layer:** pre-1.0, no cache or pre-aggregation.
6. **Metabase and Superset *as the semantic layer*:** the model is tied to the tool, and there is no
   SQL Server pre-aggregation. They stay in play as **BI tools for 744**.

## Ranked shortlist

1. **Cube Core (self-hosted)**, with Cube Store on a separate on-prem Linux/Docker host.
2. **SSAS Tabular (2019)**, importing from a pre-aggregated mart, if the edition and licence allow.

**The trade-off.**
- **Cube** gives us exactly the AI contract spec 734 wants:
  - a JSON structured query, validated against `/meta`;
  - views as the only AI surface;
  - a Git-diffable model of about 250 LOC;
  - partitioned rollups that hit the replica only in bounded slices and live **off** the replica;
  - a Postgres-wire door for Superset and Metabase;
  - all of it Apache-2.0.

  The price is a new runtime to operate (API, refresh worker, Cube Store router and workers on
  Linux), a few MSSQL rough edges, and a weak Power BI/Excel story on Core.
- **SSAS** is Microsoft-native and probably already licensed:
  - first-class Excel and Power BI;
  - RLS in Standard;
  - a team skill-set that may already exist.

  But it has no structured-query API (we would own a structured → DAX compiler), its model is
  harder to review, and Standard's **16 GB / single-partition** limits force it onto 748's marts
  and full reprocesses.

Pick Cube unless 744 lands on Power BI/Excel as the primary BI surface *and* the DBA confirms an
SSAS licence. In that case, SSAS over the marts becomes the better fit.

## Open questions for later tickets

**For 744 (BI tool):**
- Which consumer reads the layer? Superset or Metabase over Cube's SQL API are both documented.
  Power BI over Cube Core is SQL-API-only. Is Excel required?
- If Power BI or Excel is a must, does that flip the ranking to SSAS?
- Does Superset's `SEMANTIC_LAYERS` extension support Cube as a provider? **[unverified]**
- Test whether Metabase or Superset can be pointed at Cube views only, so users and the AI see the
  same members.

**For 746 (AI integration):**
- Wrap Cube REST `/load` (or `/sql` dry-run plus `/load`) as a D1 tool in SIS.Api, with:
  - a DTO;
  - a member allowlist from `/meta`;
  - the scrubber (D3);
  - an audit row per call;
  - a row cap and time-out (`queryRewrite`).
- Confirm the Cube Cloud MCP server is not needed. We shouldn't let the model talk to Cube
  directly.
- Do `public: false` members disappear from `/meta`? Test it.
- How is the JWT security context minted from an oms-react session?

**For 748 (mart build):**
- Which load goes to Cube rollups (refresh by bounded `SELECT` against the replica), and which goes
  to marts that dbt-sqlserver builds in `POS_Analytics`?
- Cube can read both as separate data sources.
- Never use `original_sql` pre-aggregations against `POS`.
- Avoid lambda rollups on MSSQL (#7188) until tested.

**For the DBA (750):**
- The edition, and whether SSAS is licensed or installable.
- A host for Cube Store (local SSD; the router and workers on an isolated network, since there is
  no built-in auth).
- A read login for Cube's refresh worker, with concurrency (`CUBEJS_CONCURRENCY`) agreed against
  replication apply.

**Unverified, to settle by experiment:**
- whether Cube Store runs on Windows;
- whether Cube's MCP server works with self-hosted Core;
- SSAS object-level security on Standard;
- whether SSAS needs a separate licence on a separate host;
- Superset's SQL Server driver docs.
