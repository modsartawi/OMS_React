---
type: wayfinder-ticket
wayfinder: task
map: 741
status: done
blocked-by: —
---

# 756 — A local spike proves Cube Core answers a governed /load over SQL Server

## Question

[746](746-how-does-the-ai-generate-queries-and-views-within-spec-734s-tool-catalogue-and-mcp.md)
made **Cube Core the v1 query engine**. Every `semantic_query` and every saved view compiles to a
Cube `/load` call. The case for Cube in
[743](743-which-on-prem-semantic-layer-gives-an-ai-a-governed-query-interface-over-sql-server.md)
comes from reading documents, not from running anything. The notes are in
[741-semantic-layer-options.md](../docs/research/741-semantic-layer-options.md), and their
"Unverified, to settle by experiment" list is part of that gap. The stack ADR should not name an
engine nobody has run. This ticket takes over that job from
[the ruled-out Metabase/Superset spike](752-a-local-spike-proves-metabase-and-superset-create-a-structured-view-by-api-and-render-arabic.md).

Run Cube on this machine and record facts. The rules:

- Use Docker and the Apache-2.0 Core images only, pinned to a version (743 read v1.8.18).
- Turn telemetry off (`CUBEJS_TELEMETRY=false`).
- Point Cube at a local SQL Server, or at a small copy of a sales table shaped like
  `RetailTrx` / `RetailTrxDetail`. **Never point it at the replica.**
- **Since 748 (2026-11-04):** Cube's v1 source is the dbt marts in `POS_Analytics`, not the raw
  tables.
  - Point the model at a `mart_till_sales_daily`-shaped table in a second database where you can.
  - Item 5's rollup is now a check that nothing is written to the source DB. It is no longer the
    v1 serving path.
  - [The dbt spike](757-a-local-spike-proves-dbt-sqlserver-builds-incremental-marts-into-a-sibling-database.md)
    may share the same local SQL Server.

1. **Driver:** does the official `mssql` driver connect to SQL Server 2019 or later from the
   container? Record the env vars that work, including encrypt and trust-cert. Does it issue only
   `SELECT`s?
2. **Model:** write a cut-down model from
   [741-v1-semantic-model.md](../docs/research/741-v1-semantic-model.md): two or three measures, a
   time dimension, a store dimension, and one view that exposes only those.
   - Hide one member with `public: false`.
   - Leave one PII-shaped column undeclared.
3. **`/load`:** run one structured query: measures, a dimension, a filter, a time grain and a
   relative date range. Record the minimum JSON that works and the SQL Cube generated
   (`/v1/sql`). Check that a query naming an undeclared or `public: false` member is refused, and
   record the error shape.
4. **`/meta`:** does a `public: false` member appear in `/meta`? This decides whether
   `describe_model` can pass `/meta` through as it is, or must filter it.
5. **Pre-aggregation:** declare one `rollup` with no `original_sql`. Run Cube Store in Docker.
   - Does the query hit the rollup? Use `usedPreAggregations` in the response.
   - Is nothing written to the source DB? Check SQL Server's write activity or the DDL log.
6. **Limits:** do a row `limit` of 10,000 and a 30 s query time-out (746's provisional cap) work
   as Cube settings? Record which env var or setting enforces each.
7. **Auth:** mint a service JWT with `CUBEJS_API_SECRET` the way SIS.Api would. Confirm that a
   call with no token or a bad token is refused.

Record the compose file, the model, the payloads and the responses as assets under
`.issues/assets/756-cube-spike/`. Link them from this ticket. If any item fails, write down what
broke. A failure is still an answer: it either reopens 743's SSAS fallback or narrows 746.

## Answer

**Cube Core passes. All seven items worked locally, so the stack ADR can name it. 743's SSAS
fallback is not reopened.** The spike did narrow 746 in four places, marked 🚩 below. Assets:
[assets/756-cube-spike/](assets/756-cube-spike/README.md) (compose file, model, seed, probe client,
one evidence file per call).

**Setup:** run 2026-11-04 with Cube `v1.8.18` and Cube Store `v1.8.18`, pinned by digest, with
`CUBEJS_TELEMETRY=false` and `CUBESTORE_TELEMETRY=false`. Production mode
(`CUBEJS_DEV_MODE=false`). The source was SQL Server **2022 CU27** (16.0.4305.5) in Docker, with a
`mart_till_sales_daily`-shaped table of 15,000 rows in a sibling `POS_Analytics` database. Cube's
login was `db_datareader` on that one database and had no access to the raw stand-in `POS_Spike`.
An XE session recorded every statement and error from that login.

1. **Driver: yes, and it only reads.**
   - The env vars are `CUBEJS_DB_TYPE=mssql`, `CUBEJS_DB_HOST`, `CUBEJS_DB_PORT`, `CUBEJS_DB_NAME`,
     `CUBEJS_DB_USER`, `CUBEJS_DB_PASS` and `CUBEJS_DB_SSL=true`.
   - 🚩 **No env var sets trust-cert.** With `CUBEJS_DB_SSL=true` alone against a self-signed
     certificate, the connection fails. It does not fail as an error on a query: the Cube **process
     exits** (unhandled `ConnectionError … self-signed certificate`,
     [log](assets/756-cube-spike/evidence/env-only-tls/cube-log-self-signed.txt)).
   - Trust-cert needs a `driverFactory` in [cube.js](assets/756-cube-spike/cube.js). That factory
     must **restate the whole `options`** (`encrypt`, `trustServerCertificate`, `useUTC`), because
     the driver's `...config` replaces `options` outright.
   - With the factory, `sys.dm_exec_connections` shows `encrypt_option = TRUE`. `CUBEJS_DB_SSL=false`
     also connects, unencrypted.
   - Prod should install the replica host's CA rather than trust any certificate.
   - **The [XE trace](assets/756-cube-spike/evidence/trace-full.txt) across the whole spike holds
     76 `SELECT` RPCs, 19 `SET` session-init batches, and nothing else.** The one error is my own
     overflow probe.
   - The session runs at `read committed`, which is fine under the replica's RCSI.
   - Arabic `nvarchar` came back intact.
2. **Model: [till_sales_daily.yml](assets/756-cube-spike/model/cubes/till_sales_daily.yml) and
   [till_sales_view.yml](assets/756-cube-spike/model/views/till_sales_view.yml).**
   - It has four measures over the mart and a time dimension, plus store code, city and country.
   - `gross_till_value_sar` is `public: false`. `top_customer_mobile` is in the table and left
     undeclared.
   - **Two modelling rules came out of it:**
     - **A member must not share its cube's name.** A `till_sales` measure inside a `till_sales`
       cube broke the rollup (`'undefined' not found for path 'till_sales'`), even with
       `CUBE.`-prefixed references. The fix was to name the cube after the mart.
     - **`type: count` is `COUNT(*)`, which is `int`.** Use `COUNT_BIG(*)` for row counts at
       `RetailTrx` scale.
3. **`/load`: works.**
   - The minimum query:
     `{"measures":[…till_sales, …net_till_value_sar, …return_rate],"dimensions":["till_sales_view.city"],"filters":[{"member":"till_sales_view.country","operator":"equals","values":["KSA"]}],"timeDimensions":[{"dimension":"till_sales_view.sales_date","granularity":"week","dateRange":"last 4 weeks"}]}`.
     The generated SQL, both the Cube Store SQL and the source build SQL, is in
     [3b-sql.json](assets/756-cube-spike/evidence/3b-sql.json).
   - **The refusals come in different shapes:**

     | Query | Status | Body | Reaches SQL Server? |
     |---|---|---|---|
     | Undeclared member | **400** | `{"type":"UserError","error":"'top_customer_mobile' not found for path …"}` | No |
     | Member not in the view | **400** | `UserError` | No |
     | `public: false` member, or a member of a `public: false` cube | **500** | `{"error":"Error: You requested hidden member: …"}`, with no `type` | **Yes** |

   - 🚩 **`public: false` is checked *after* the source query runs.** The XE trace shows
     `SELECT TOP 10000 sum(gross_value_sar)…` completing 10 ms before the 500 goes out. The data is
     withheld, but the load lands.
   - So masking by construction must rest on **not declaring** a member, which is refused at
     compile. `public: false` is not enough.
   - SIS.Api must also **check every member against the `/meta` catalogue before calling `/load`**.
   - The status codes cannot be mapped as they come. A database error also returns 400 with SQL
     Server's own text ([6f0](assets/756-cube-spike/evidence/6f0-slow-int-overflow.json)). SIS.Api
     should map these into its own `ApiError` taxonomy and run them through the D3 scrubber, never
     pass them to the model as they are.
4. **`/meta`: `public: false` members are absent.**
   - The hidden measure and the pk are both missing from
     [/meta](assets/756-cube-spike/evidence/4-meta.json).
   - When the cubes are public, `/meta` lists the **raw cubes next to the view**.
   - With every cube `public: false` (variant B,
     [B1](assets/756-cube-spike/evidence/B1-meta-views-only.json)), `/meta` holds only the view, and
     the view still queries through the hidden cubes and their rollup.
   - ⇒ **`describe_model` can pass `/meta` through as it is if every cube is `public: false` and
     only views are public.** That makes it a rule of the model.
5. **Pre-aggregation: hit, and nothing written to the source.**
   - The rollup (`daily_by_store`: day grain, month partitions, no `original_sql`) served all of
     these queries, according to `usedPreAggregations`:
     - cube queries and view queries;
     - a derived ratio (`return_rate`);
     - a custom granularity.
   - It was built by bounded per-month `SELECT … GROUP BY` queries streamed into Cube Store.
   - The `SELECT * INTO` in `loadSql` is **not run** for an external rollup.
   - Nothing was written to the source. The
     [DDL trigger](assets/756-cube-spike/evidence/5-ddl-log.txt) logged only my own seed as `sa`, no
     pre-aggregation schema appeared in `POS_Analytics`, and the XE trace holds no write.
   - 🚩 **Cube Store has no arm64 image.** It ran here as amd64 under emulation. Windows-native was
     not tried, so the plan stays a Linux amd64 host.
6. **Limits: both work as Cube settings.**
   - **Row cap:** `CUBEJS_DB_QUERY_LIMIT=10000`. A query asking for `limit` 10001 or 50000 gets
     **500** `The query limit has been exceeded.` 10,000 is served.
   - `CUBEJS_DB_QUERY_DEFAULT_LIMIT=10000`: a query with no limit is **silently cut** to 10,000 rows
     (15,000 existed). `total: true` returns the real count (14,900,
     [B5](assets/756-cube-spike/evidence/B5-total-flag.json)), so SIS.Api should send it and tell
     the user the result was capped.
   - **Time-out:** `CUBEJS_DB_QUERY_TIMEOUT=30s` does two things:
     - the orchestrator gives up at **30.15 s**, with 400 `Query execution timeout after 0.5 min of
       waiting`;
     - the same value is the mssql `requestTimeout`, and SQL Server logs the statement as
       **`result = Abort` at 30.35 s**, with nothing left running
       ([6f](assets/756-cube-spike/evidence/6f-slow-sqlserver-side.txt)).
   - `/load` answers 200 `{"error":"Continue wait"}` about every 10 s while a query runs, so
     SIS.Api's client must poll.
7. **Auth: works, with no library needed.**
   - SIS.Api would sign an HS256 JWT over `CUBEJS_API_SECRET` (`{sub, actor, iat, exp}`;
     [probe.mjs](assets/756-cube-spike/probe.mjs) `mintJwt`). Cube accepts it.
   - Every bad call gets 403: no header gives `Authorization header isn't set`; a bad signature, an
     expired token and a malformed one all give `Invalid token`.
   - Cube logs the token's `securityContext` with every request, which gives an actor trail.
   - ⚠ **Cube also logs every rejected token in full.** Cube's logs belong in the same restricted
     place as SIS.Api's secrets.

**Smaller facts the build needs:**
- Cube's built-in `week` starts **Monday**. A custom granularity (`interval: 1 week`, origin a
  Sunday) gives Sunday weeks, served from the day rollup
  ([B4](assets/756-cube-spike/evidence/B4-saudi-week.json)).
- A relative range like `last 4 weeks` still resolves to **Monday-aligned** bounds, which gives
  partial edge buckets. SIS.Api should resolve week ranges to explicit dates itself.
- The query timezone defaults to **UTC**, so send `timezone: "Asia/Riyadh"`, or "today" is wrong
  between 00:00 and 03:00.
- Numeric values come back as **strings**.

**Not covered:**
- SQL Server 2019. Only 2022 was run, and the driver is the same `tedious`.
- Windows auth (`trustedConnection`).
- A multi-node Cube Store cluster.
- The Postgres-wire SQL API.
- Real row counts. Emulated SQL Server says nothing about replica performance; that is 750's job.
