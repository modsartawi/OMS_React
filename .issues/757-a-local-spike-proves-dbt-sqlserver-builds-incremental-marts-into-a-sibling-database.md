---
type: wayfinder-ticket
wayfinder: task
map: 741
status: done
blocked-by: —
---

# 757 — A local spike proves dbt-sqlserver builds incremental marts into a sibling database

## Question

[What builds the marts](748-what-builds-the-marts-views-on-the-replica-dbt-into-a-sibling-database-or-a-copy-to-a-columnar-store.md)
chose **dbt (`dbt-sqlserver`) into `POS_Analytics`**, a sibling of `POS` on the same instance. That
choice was made from reading, not running. Following the rule of
[the Cube spike](756-a-local-spike-proves-cube-core-answers-a-governed-load-over-sql-server.md),
the stack ADR should not name a tool nobody has run. **AFK.**

The rules:
- Use a local SQL Server 2019 or later (Docker or Developer edition) with two databases: a
  `POS`-shaped source holding small, synthetic `RetailTrx`, `SdDocumentHeader` and `SdDocumentLog`
  tables, and a `POS_Analytics` target. **Never point anything at the replica.**
- Use dbt Core and `dbt-sqlserver`, pinned to versions, with anonymous usage stats off.

Record facts for each item:

1. **Adapter:** do `dbt-core` and `dbt-sqlserver` connect to SQL Server 2019 or later? Record the
   `profiles.yml` that works (driver, encrypt, trust-cert). Can a source in database `POS` feed a
   model built in `POS_Analytics`, using three-part names, with the dbt login holding only
   `db_datareader` on the source?
2. **Incremental by day:** build `mart_till_sales_daily` with a lookback variable that rebuilds the
   last N days.
   - Is the swap of one day **atomic**? Kill the run mid-swap: does a reader see the old day, the
     new day or a gap?
   - Record the `incremental_strategy` that gives an atomic swap. If none does, record the custom
     materialization or the staging-then-swap macro that does.
3. **Write audit:** confirm that nothing is written to the source DB. That covers temp tables and
   views created in `POS` by the adapter: check SQL Server's DDL log or `sys.objects` before and
   after.
4. **`fct_delivery`:** apply the first-event rule (the first `DCRT` / `DRDY` / `DOFD` / `DDLR` per
   delivery, ADR 0081) over synthetic `SdDocumentLog` data at about 1M events. Then:
   - time a 92-day `PERCENTILE_CONT(0.5)` and `PERCENTILE_CONT(0.9)` by store over it;
   - check the result against `DispatchScorecardMath.Percentile` (INC) on a small, hand-checked
     sample.
5. **Tags and jobs:** run `dbt build --select tag:intraday` and `tag:nightly`, and
   `dbt source freshness` with a stale source. Does the stale source fail the run **before** any
   swap?
6. **The load log:** a post-hook writes one row per run to `mart_load_log`, holding the newest
   source event time. Record the macro.
7. **Container:** does the official dbt image, or a pinned Python image, run the project from a
   scheduled container? Record the Dockerfile and how long a cold start takes.

Record the project, the profiles (no secrets), the timings and the outputs as assets under
`.issues/assets/757-dbt-spike/`, and link them from this ticket.

A failure is still an answer. Item 2 or 3 failing reopens 748's choice: a SQL Agent job running
stored procedures in `POS_Analytics` is the next candidate, then 748's Cube Store fallback.

## Answer

**dbt-sqlserver passes all seven items, so 748's choice stands.** Items 2 and 3 were the ones that
could reopen it, and both hold. The swap of a day is atomic for every committed reader, and dbt
writes nothing to the source DB. The spike also narrowed the build in six places, marked 🚩 below.
Assets: [assets/757-dbt-spike/](assets/757-dbt-spike/README.md) (the Dockerfile, the dbt project,
the seed and audit SQL, the kill test, the C# INC check, and one evidence file per step).

**Setup:** run 2026-11-04.
- **dbt:** dbt-core **1.12.6**, `dbt-sqlserver[pyodbc]` **1.12.2**, pyodbc 5.3.0 and ODBC Driver 18
  (18.7.1.1), on a pinned `python:3.12-slim-bookworm`. Every transitive package is pinned. Usage
  stats are off in both the image and the project.
- **SQL Server:** 2022 CU27 in Docker (amd64 under emulation, the 756 image), with two databases:
  - a synthetic `POS` holding 100 stores, 298,620 `RetailTrx` rows, 467,804 `SdDocumentHeader` rows
    (one order and one delivery per delivery) and **1,006,959 `SdDocumentLog` events** over 120 days;
  - an empty `POS_Analytics`.
- **Logins** (748's names): `svc_analytics_dbt` is `db_owner` on `POS_Analytics` and only
  `db_datareader` on `POS`. `svc_analytics_cube` is `db_datareader` on `POS_Analytics` only.
- **The audit:** an XE session recorded every statement from the dbt login and every object
  created anywhere. POS also held a DDL trigger.

1. **Adapter: yes, and three-part names work with a reader-only login.**
   - The [profiles.yml](assets/757-dbt-spike/dbt/profiles.yml) that works sets `type: sqlserver`,
     `backend: pyodbc`, `driver: "ODBC Driver 18 for SQL Server"`, `encrypt: true` and `trust_cert`
     (from an env var), and takes the password from `DBT_ENV_SECRET_PASSWORD`, which dbt scrubs from
     its logs ([debug](assets/757-dbt-spike/evidence/1b-dbt-debug.txt)).
   - `trust_cert: false` against the self-signed box fails cleanly with `08001 … certificate verify
     failed` ([1c](assets/757-dbt-spike/evidence/1c-debug-trust-cert-false.txt)). It does **not**
     crash the process the way Cube's did (756). In prod, install the replica host's CA instead.
   - The sources declare `database: POS`, and the models build into `POS_Analytics`. The compiled SQL
     reads `"POS"."dbo"."SdDocumentLog"`, and the first build took 2.3 s
     ([2a](assets/757-dbt-spike/evidence/2a-first-build.txt)).
   - 🚩 **pyodbc is an extra.** Plain `pip install dbt-sqlserver` installs no driver binding at all,
     so the install must be `dbt-sqlserver[pyodbc]`.
   - Smaller facts:
     - `dbt debug` fails its `git` check until git is installed. git is only needed for packages,
       and the project uses none.
     - `| as_bool` refuses the string `true`, so the profile compares the env var instead.
     - The adapter builds **clustered columnstore tables by default**. The spike set
       `as_columnstore: false`; for the marts, the build should decide it on purpose.
2. **Incremental by day: yes, and the swap is atomic.**
   - **The strategy is the built-in `delete+insert`** with `unique_key: sales_date`. dbt first
     stages the lookback days into `<mart>__dbt_tmp`; that read of `POS` autocommits *before* the
     transaction. It then sends `DELETE … WHERE sales_date IN (SELECT sales_date FROM __dbt_tmp)` and
     the `INSERT`, followed by the in-transaction post-hooks and one `COMMIT`
     ([the statement](assets/757-dbt-spike/evidence/2d-swap-statement.txt)). No custom
     materialization is needed.
   - **The lookback variable:** `lookback_days` (null = 748's intraday rule: today, plus yesterday
     before 02:00 Riyadh). Nightly passes 3, and the post-reinit runbook passes N. A value that is
     not a whole number 1–`history_days` now **fails the run**. Before that guard, a typo like `"x"`
     cast to 0, started the window tomorrow and *silently rebuilt nothing*.
   - **A run killed mid-swap**, held open 40 s after delete+insert and before COMMIT, then
     `docker kill`ed:
     - **RCSI off** ([A](assets/757-dbt-spike/evidence/2-kill-A-rcsi-off/)):
       - a `READ COMMITTED` reader **blocks** on the X locks. A 3 s lock timeout fails with 1222;
       - a sampler took **612,994 reads across the kill and every one saw the old day** (781). The
         longest read waited 6.2 s, which was dbt's whole transaction;
       - after the kill, the old day stands (781).
     - **RCSI on** ([C](assets/757-dbt-spike/evidence/2-kill-C-rcsi-on/)): readers **never block**
       (618,273 samples, the longest 8 ms) and see the old day (1781) throughout. After the kill it is
       still 1781. The next run lands the new day (2081).
     - **A normal run under the sampler**
       ([B](assets/757-dbt-spike/evidence/2-swap-B-normal-run/)): committed readers go 781 → 1781
       with **no gap**. 🚩 A `READ UNCOMMITTED` (NOLOCK) reader **saw 0 for 29 samples (~5 ms)**,
       between the delete and the insert. In the paused run it also read the never-committed new day.
     - ⇒ **`POS_Analytics` should run with `READ_COMMITTED_SNAPSHOT ON`**, so Cube's reads never wait
       on a swap, and nothing that reads the marts may use NOLOCK.
   - **What a kill leaves behind:**
     - the `__dbt_tmp` table and its `__dbt_tmp_vw` view, both in `POS_Analytics`. The next run drops
       them ([8](assets/757-dbt-spike/evidence/2-kill-A-rcsi-off/8-leftovers-after-kill.txt),
       [B/8](assets/757-dbt-spike/evidence/2-swap-B-normal-run/8-objects-after.txt));
     - **no `mart_load_log` row.** on-run-end never runs, so a killed run shows only in the
       scheduler's log and exit code. "Data as of" simply does not advance, which is the fail-closed
       behaviour 748 asked for.
   - **Caveat:** delete+insert deletes only the days present in the new slice. A day that is empty
     in the source keeps its old rows. Estate-wide, that happens only when the source itself is
     missing data, which the freshness gate (item 5) stops first.
3. **Write audit: nothing is written to `POS`.**
   - The [XE capture](assets/757-dbt-spike/evidence/3-trace-full.txt) shows that every batch from
     the dbt login ran in database context `POS_Analytics`.
   - **107 statements name `"POS".`, and every one reads it in `FROM`/`JOIN`.** None is
     write-shaped (`INTO`, `UPDATE`, `TABLE`, `VIEW`, `DELETE`, `MERGE` or `USE POS`)
     ([3c](assets/757-dbt-spike/evidence/3c-trace-pos-statements.txt)).
   - Every object dbt created is in `POS_Analytics`
     ([3b](assets/757-dbt-spike/evidence/3b-trace-summary.txt)): the `__dbt_tmp` tables and views,
     `mart_load_log`, the seed table, and the `testview_*` views that `dbt test` creates.
   - POS's DDL trigger logged only `sa`, which was my own seeding
     ([3e](assets/757-dbt-spike/evidence/3e-pos-ddl-log.txt)). POS's `sys.objects` before and after
     differ only in that log's own row count ([3d](assets/757-dbt-spike/evidence/3d-pos-objects-diff.txt)).
   - 🚩 **One side effect is the engine's, not dbt's.** With `AUTO_CREATE_STATISTICS` on, SQL Server
     created **24 `_WA_Sys_*` statistics on POS tables in response to the dbt login's reads**.
     - Any reader does this, including 750's own probe.
     - On the replica subscriber, these are statistics on articles: they survive until a reinit and
       could be noticed by the DBA.
     - It is a DBA note for 749, not a reason to reopen 748.
4. **`fct_delivery`: the first-event rule holds, the percentiles are fast enough, and SQL Server's
   percentile is INC.**
   - **The model** ([fct_delivery.sql](assets/757-dbt-spike/dbt/models/marts/fct_delivery.sql))
     re-derives every delivery that logged a `DCRT`/`DRDY`/`DOFD`/`DDLR`, or was created, since the
     lookback start. It takes `MIN` per code **over all of that delivery's events**, not only the
     window's, so a re-post on a later day never moves a first time.
     - It falls back to the header's `EntryTime` when there is no `DCRT` (2638).
     - It treats `0001-01-01` as null with a `>= '19000101'` test. `NULLIF(x, '0001-01-01')` fails on
       a `datetime` column.
     - It is incremental **by delivery** (`unique_key: delivery_no`), not by day.
   - **Size and speed:** 1.007M events → 233,902 deliveries, 210,391 of them delivered. The full
     build takes 2.3 s; an incremental run takes 1.0–1.6 s.
   - **The 92-day exact percentile by store**
     ([timings](assets/757-dbt-spike/evidence/4e-percentile-timing.txt)). The query computes p50 and
     p90 of both `order_to_delivered_min` and `ready_to_delivered_min`, as `svc_analytics_cube`,
     with SQL Server under emulation:

     | Window rows | Storage | Elapsed | CPU |
     |---|---|---|---|
     | 179,080 (synthetic, 1×) | heap | 0.6–0.8 s | 4.0–4.7 s |
     | **1,432,640 (8× copy ≈ prod's 92 days at ~6M/yr)** | heap | 1.6–2.4 s | 15–20 s |
     | same | rowstore clustered `(created_date, store_code)` | 1.55–1.97 s | 14–19 s |
     | same | clustered columnstore | 1.61–1.65 s | ~15 s |
     | same, `MAXDOP 1` / `2` / `4` | columnstore | 4.6 / 5.2 / 2.5 s | 4.6 / 10.2 / 9.7 s |
     | same, one store | columnstore | 35 ms | 36 ms |

     - The sort dominates; the index shape barely moves the timing.
     - Every case is well inside 746's 30 s cap, so the 92-day cap could later be lifted on these
       numbers.
     - 🚩 **Unbounded parallelism costs three times the CPU of `MAXDOP 1`, for about 2.5× less
       wait.** The Resource Governor group that 748 asks the DBA for should cap Cube's login at
       `MAX_DOP` 4 or less.
   - **INC parity is bit-identical.** `PERCENTILE_CONT` and `DispatchScorecardMath.Percentile`
     ([copied verbatim, run with dotnet](assets/757-dbt-spike/inc-check/Program.cs)) agree to 17
     significant digits on every group ([SQL](assets/757-dbt-spike/evidence/4b-inc-sample-sql.txt),
     [C#](assets/757-dbt-spike/evidence/4d-inc-sample-csharp.txt)). The groups were:
     - the BackOffice unit test's `{4,1,3,2}`;
     - the hand-worked samples `{7}` → 7/7, `{10..50}` → 30/46 and `{3,5,8,10,20,29}` → 9/24.5;
     - three real stores on one day, holding 17, 28 and 15 deliveries.

     Both print 3.7000000000000002 and 244.30000000000001 for the two values that have no exact
     binary form.
5. **Tags and jobs: they work, but 🚩 `dbt build` never checks freshness itself.**
   - `tag:intraday` builds both marts and their tests
     ([2b](assets/757-dbt-spike/evidence/2b-intraday-run.txt)). The seed is tagged `nightly` only.
   - `tag:nightly` with lookback 3 builds the seed, the marts, the uniqueness and not-null tests,
     and the yesterday reconciliation of the till mart against `RetailTrx`
     ([5i](assets/757-dbt-spike/evidence/5i-job-nightly-fresh.txt)).
   - **With a stale source** (`SdDocumentLog`'s last 90 minutes stashed, plus 200 new till sales
     today):
     - **a bare `dbt build` swapped anyway**: today's slice went 833 → 1033
       ([5g](assets/757-dbt-spike/evidence/5g-bare-build-stale.txt));
     - **the job entrypoint [run-job.sh](assets/757-dbt-spike/dbt/run-job.sh) runs `dbt source
       freshness` first.** It got `ERROR STALE`, exited 3, ran no model, left the slice at 833, and
       logged a `stale_source` row ([5d](assets/757-dbt-spike/evidence/5d-job-intraday-stale.txt),
       [5f](assets/757-dbt-spike/evidence/5f-load-log-after-stale-job.txt)).
     - ⇒ **Fail-closed is a property of the job script, not of dbt.** The scheduler must only ever
       call the script.
   - 🚩 **Freshness compares against the server clock.** `SYSDATETIME()` is in the server's own time
     zone, while POS writes Riyadh local time. The project overrides `sqlserver__collect_freshness`
     to snapshot in UTC, and each `loaded_at_field` converts with `DATEADD(hour, -3, …)` (no DST).
     - Without the override, a UTC box sees POS 3 hours "in the future" and never goes stale.
     - `RetailTrx` also needs a filter `TrxDate <= now`, because bad till clocks write 2028
       (745).
6. **The load log: [load_log.sql](assets/757-dbt-spike/dbt/macros/load_log.sql).**
   - **`log_load()` is a post-hook**, so it runs *inside* the swap transaction and its row commits
     with the swap or not at all. It writes one row per mart per run: invocation id, job, lookback
     start, row count, and `newest_source_event_at`.
   - `newest_source_event_at` is `MAX(_source_newest_at)` of what the mart now holds, so an event
     that lands mid-run is never claimed. "Data as of" = the minimum, over the marts, of their last
     `success` row.
   - **Two other writers cover failures:**
     - `log_failed_models(results)`, on-run-end, writes `error`/`skipped` rows. It needs
       `auto_begin=False`: an on-run-end insert inside a transaction is **never committed**. The
       first version lost its row; identity 2 was consumed and never seen.
     - `log_job_failure`, a run-operation, writes the `stale_source` row.
   - The hook must be passed as the *string* `"{{ log_load() }}"`. Calling the macro inside
     `config()` renders it at parse time, when `is_incremental()` is false, and every row then
     logged the history start ([6a](assets/757-dbt-spike/evidence/6a-failed-run.txt),
     [6b](assets/757-dbt-spike/evidence/6b-load-log-tail.txt)).
7. **The container: a pinned Python image runs it.** There is no official one to use: dbt Labs
   publishes no dbt-sqlserver image, and `ghcr.io/dbt-labs/dbt-core:1.9.latest` has no arm64
   manifest.
   - **The image:** [Dockerfile](assets/757-dbt-spike/Dockerfile) = `python:3.12-slim-bookworm`
     pinned by digest, plus `msodbcsql18`, plus the pinned requirements. It is 426 MB and builds in
     about 50 s.
   - **Cold start:**
     - one `run-job.sh intraday` (container start, freshness, build, exit) took **7.6–11.4 s** of
       wall time ([7c](assets/757-dbt-spike/evidence/7c-cold-start-timings.txt));
     - the container start plus `dbt --version` alone takes 4.2 s;
     - each of the two dbt invocations does a full parse of about 1 s;
     - a `dbt parse` baked into the image is discarded ("profile has changed"), so it was dropped.
   - **The schedule:** [crontab.example](assets/757-dbt-spike/schedule/crontab.example), which
     uses `docker run --rm --name dbt-intraday … intraday` every 15 minutes and nightly at 00:00 UTC.
     **The fixed name is the overlap guard:** a second start while one runs fails with `Conflict`,
     exit 125 ([7d](assets/757-dbt-spike/evidence/7d-overlap-guard.txt)).

**What this hands on:**
- **The stack ADR** may name dbt Core with `dbt-sqlserver[pyodbc]`. The ADR should name versions,
  `delete+insert` by day for the daily marts and by delivery for `fct_delivery`, and the job script
  as the fail-closed gate.
- **749's checklist gains five items:**
  - `READ_COMMITTED_SNAPSHOT ON` for `POS_Analytics`;
  - a Resource Governor `MAX_DOP` of 4 or less for `svc_analytics_cube`;
  - the replica host's CA certificate for the dbt container, rather than `trust_cert`;
  - the auto-created-statistics note for the DBA;
  - an env file at mode 0600 on the analytics host for `DBT_ENV_SECRET_PASSWORD`.
- **Not run here:** dbt against a real replica (never in scope), and Linux amd64 for the dbt image
  (the analytics host). The image has no arch-specific step, but it was built only for arm64.
