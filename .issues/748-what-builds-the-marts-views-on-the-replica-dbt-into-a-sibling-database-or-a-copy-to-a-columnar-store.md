---
type: wayfinder-ticket
wayfinder: grilling
map: 741
status: done
blocked-by: 742, 743, 745, 750 (750 waived by the owner, 2026-11-04 — settled provisional on it)
---

# 748 — What builds the marts: views on the replica, dbt into a sibling database, or a copy to a columnar store?

## Question

Given the replica's headroom (742), the semantic layer's caching (743) and the v1 subject areas
(745), what is the **pipeline**?

The options:
1. **No pipeline:** the semantic layer queries the replica directly, with only its own
   pre-aggregations.
2. **dbt into a sibling database:** dbt (`dbt-sqlserver`) or SQL Agent jobs build marts into a
   sibling database on the replica's instance.
3. **A columnar copy:** an off-replica copy, for example ClickHouse or DuckDB, fed by a scheduled
   extract or CDC.

Settle:
- the refresh cadence per subject area. 734 D2's nightly rollup, plus a same-day partial every 15
  minutes, is the precedent;
- who owns and runs the jobs;
- what happens when the replica is reinitialised;
- whether 734's `sales_summary` rollup becomes one of these marts rather than a second copy.

## Answer

**Settled with the owner, 2026-11-04.** 750 was still half done: the busy-hour run was in, but the
off-hours run and the DBA's answers were owed. The owner chose to settle now, with 750's open items
as **re-open triggers** (below) rather than blockers.

### The owner's four rulings

1. **Settle now**, provisional on 750.
2. **The pipeline is option 2: dbt into a sibling database.**
   - `dbt-sqlserver` (dbt Core, Apache-2.0) builds marts into **`POS_Analytics`**, a new database
     beside `POS` on `DWPOSREPL03`. `ZC` and `BusinessMonitor` are the precedent (742 §3a).
   - Cube (743/746) reads the marts. It no longer reads the raw till and order tables for
     aggregates.
   - This overrules my recommendation of Cube Store rollups only, with no pipeline.
   - Options 1 and 3 are out for v1. Option 1 comes back only as the fallback named below.
3. **Delivery-speed percentiles are computed live and capped at 92 days.**
   - Each query computes its median or p90 exactly: `PERCENTILE_CONT`, SQL Server's twin of
     `PERCENTILE.INC`, the method `DispatchScorecardMath.Percentile` uses.
   - Results are cached for 15 minutes.
   - The semantic model refuses a percentile measure over a window longer than 92 days. Counts and
     shares have no such cap.
4. **Freshness:** today's slice refreshes every 15 minutes, and the last three days are rebuilt
   nightly. This is 734 D2's precedent, applied to every area.

### What follows from them (my rulings, overrulable)

**The marts.** Each mart is incremental, keyed by business date, and replaced a whole day at a time.

| Area | Mart (grain) | Feeds |
|---|---|---|
| 1 Till sales | `mart_till_sales_daily` (date × store × country × NPHIES-linked flag): additive counts and SAR sums for every till measure in the 745 catalogue. Shares are stored as numerator and denominator, never as a ratio | `till_sales` … `nphies_linked_sales`; 734's `sales_summary` |
| 2 Orders | `mart_orders_daily` (date × store × channel group × document type) | `orders` |
| 3 Delivery speed | **`fct_delivery`**: one row per delivery, holding its first-ever `DCRT` / `DRDY` / `DOFD` / `DDLR` times (ADR 0081), the order's `EntryTime`, its store and its channel. About 6M rows a year. Plus `mart_delivery_daily`, which holds the counts and the same-day numerator | counts from the daily mart; **percentiles computed live over `fct_delivery`** |
| 4 Callouts, donors (after 753) | `fct_callout` and `fct_donor_request` (one row per item), plus their daily count marts | the same pattern: counts from the daily marts, medians computed live over the fact tables. Parity with the scorecard is the acceptance check |

- **What "live" means under ruling 3.** Each query computes the percentile over **`fct_delivery`
  in `POS_Analytics`**, not over the raw `SdDocumentLog` events. That table is 15 minutes fresh
  with the first-event rule already applied, so the replica never sees an interactive first-event
  scan.
  - It is still exact INC per query, and it is still capped at 92 days, as the owner ruled.
  - The cap can be lifted later, on a measured timing (the dbt spike below).
- **Every mart carries `_loaded_at`.** A `mart_load_log` table holds one row per run, with each
  source's newest event time. Freshness is shown as the screen's **"data as of HH:MM"** (755): the
  newest event time from the last good run, not the moment the run finished.
- **The dimensions** (store, city, region, channel map, the Sunday week, dates capped at today)
  are dbt seeds and models in the same project. Cube declares them over the marts once. The
  `DocumentSource` → five-group map is a dbt seed, and it is the only copy.
- `Material` and `StoreGroup` being missing does not matter for v1: there is no product dimension,
  and region comes from `StoreArea`.

**Refresh cadence.** There are two dbt jobs per area, selected by tag:

- **`intraday`, every 15 minutes:**
  - It rebuilds today's slice, and before 02:00 yesterday's too.
  - It builds the slice into a staging table, then swaps it in inside one transaction. A failed run
    leaves the last good slice in place; it never leaves a gap.
- **`nightly`, at 03:00 (in 750's off-hours window):**
  - It rebuilds the last three days, to pick up late till uploads and out-of-order log events.
  - It runs `dbt test`: uniqueness, not-null, and the till-value reconciliation of the daily mart
    against a direct `RetailTrx` sum for yesterday.
  - It runs `dbt source freshness`.
- **Bounds:** dbt runs with one or two threads, and every source query is bounded by date. The
  replica only ever sees bounded, scheduled `SELECT`s from the dbt login. It sees none of Cube's
  interactive traffic.
- **Area 4** joins the same two jobs once 753 lands.

**Who owns and runs the jobs.**

- **We (the BackOffice dev team) own the dbt project.**
  - It lives in the BackOffice repo beside the Cube model: one `Analytics/` folder with `dbt/` and
    `cube/`. The definitions sit in one reviewable tree.
  - That partly clears the "who keeps the semantic model" fog. The review process stays fog.
- **The scheduler runs on the analytics host** that 749 provisions (Linux or Docker, beside Cube):
  a scheduled container running `dbt build --select tag:…`.
  - It does **not** run in SQL Agent on `DWPOSREPL03`. That keeps Python off the DB server and keeps
    our code out of the DBA's job list.
- **The DBA (the owner, acting as DBA, as in 753) owns:**
  - the database `POS_Analytics`, its size budget and its backups (or none, since it can be
    rebuilt);
  - one writer login, provisionally **`svc_analytics_dbt`**: `db_owner` on `POS_Analytics`,
    `db_datareader` on `POS`;
  - Cube's reader login, provisionally **`svc_analytics_cube`**: `db_datareader` on `POS_Analytics`
    **only**.
  - With Enterprise edition available, the DBA is also *asked* (not required) for a Resource
    Governor workload group capping both logins (750 §4, item 1).

**When the replica is reinitialised:**

- **`POS_Analytics` survives.** Reinitialisation touches only the subscription database's articles
  (742 §2a). The marts and `fct_*` keep their history, and the screens keep answering, with
  "data as of" visibly falling behind.
- **During the reinit**, the source-freshness check fails, so runs fail **closed**: no swap, and the
  last good slice stays.
  - The `mart_load_log` row records the failure.
  - The board shows the stale "as of"; it does not show an empty chart.
- **After the reinit**, a runbook step, `dbt build --vars '{lookback_days: N}'`, rebuilds the days
  the outage spanned. It is **never** a `--full-refresh` of the history: a year of
  `RetailTrxDetail`-scale extraction took about 20 minutes on joins (742).
- **If the reinit dropped the subscriber-side NCCI columnstores** (750 §4, item 3), the users do not
  notice, because they read marts. Only the dbt runs slow down. That makes DBA item 3 a question of
  **run duration**: whether a 15-minute intraday run still fits inside 15 minutes on rowstore. It no
  longer decides what users see.

**734's `sales_summary` rollup.**

- **`mart_till_sales_daily` is that rollup. There is one permanent copy.**
- BackOffice 3346 (spec 3345, for the pitch) builds its own nightly-plus-15-minute rollup on HQ "if
  none exists". This map is separate from the pitch, and `POS_Analytics` will not exist by about
  2026-12-03, so **3346 proceeds as specified.**
- At parity, 746 already re-points `sales_summary` to `semantic_query`. That same step
  **retires 3346's rollup and its job**. Until then there are two copies, deliberately, and the
  parity check is what ends that.
- This is a **BackOffice ask for the spec hand-off**, not filed from here (BackOffice is read-only
  from this map). It has two parts:
  - 3346 records where its rollup lives;
  - the parity ticket deletes it.

### Re-open triggers (from 750, still owed)

| 750 item | If it comes back… | Then |
|---|---|---|
| 9: the sibling DB is refused | No `POS_Analytics` on `DWPOSREPL03` | **Fallback:** the same dbt project targets a separate on-prem SQL Server, pulling over the `read` login by bounded query (742 option c). If no host is allowed either: option 1, with Cube Store rollups and percentiles computed live on the replica |
| 7: the four-parallel test moves replication lag | The replica can't carry dbt runs and interactive queries together | Resource Governor workload group, `threads: 1`, and widen intraday to 30 minutes. The owner rules on the cadence change |
| The off-hours run is much slower than the busy-hour run | Something else heavy runs at night (750 §4, item 4) | Move `nightly` to the quiet hour the DBA names |
| 3: columnstores aren't re-created after a reinit | Intraday runs overrun 15 minutes on rowstore | The DBA scripts NCCI re-creation into the reinit runbook, or intraday widens |

### What this hands on

- **757 (new):** a local spike proving `dbt-sqlserver` builds the incremental marts, and how long
  `fct_delivery` and the percentile take. The ADR should not name a tool nobody has run (the
  756 rule).
- **749:** the checklist gains `POS_Analytics`, the two `svc_analytics_*` logins and the dbt
  scheduler container on the analytics host. Its path list gains *analytics host → `DWPOSREPL03`
  :1433*.
- **756:** Cube reads mart tables, not raw till tables. Its rollup step (item 5) stays as a check
  that nothing is written to the source DB, but it is no longer the v1 serving path.
- **The map's fog:** the freshness patch is cleared. The "guarding cost and load" patch narrows to
  Cube's result cache and the replica's concurrency, which is sized by 750.
