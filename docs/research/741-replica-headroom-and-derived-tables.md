# 741 / 742 — Replica headroom, and where derived tables may live

> Research for [What analytical load can the replica carry, and where may derived tables live?](../../.issues/742-what-analytical-load-can-the-replica-carry-and-where-may-derived-tables-live.md).
> Written 2026-11-03. **Half measured, half not.** The replica (`172.23.27.47` / `POS`,
> `DWPOSREPL03`) did not answer from this machine: `Test-NetConnection … -Port 1433` returned
> `TcpTestSucceeded = False` from the Parallels NAT address `10.211.55.3`. So:
> - §1–§2 come from what the estate has already recorded (BackOffice ticket 1260, BackOffice
>   memory, the BackOffice code) plus Microsoft documentation.
> - §3 is the measurement still owed. It is a read-only query pack, [741-replica-probe.sql](741-replica-probe.sql),
>   for the owner to run on the corporate network.
>
> `[n]` refers to **Sources** (§6).

---

## 1. Summary

- **The replica is SQL Server 2019** (RTM-CU32-GDR) on `DWPOSREPL03`, a separate host from the
  live OMS (`DWPOS03`, `172.23.27.50`, off limits) [1]. The `read` login is `db_datareader`, with
  `CREATE TABLE = 0` [1]. **Nothing can be created in `POS` by us.** Every placement option below
  needs a DBA.
- **The edition is not yet known, and it matters.** Resource Governor is the only engine feature
  that can cap analytics CPU and memory per workload, and in 2019 it is **Enterprise only** [6].
  On Standard, the only protection is in the client: a time-out, a row cap, a concurrency limit and
  a results cache in the semantic layer. Probe P1 settles this.
- **Till sales are analytics-ready; orders are probably not.** `RetailTrx` (about 463M rows) and
  `RetailTrxDetail` (about 1.0B) carry NCCI columnstores. A full-year aggregate takes 1–2 minutes;
  a year-to-date extract with joins took about 20 minutes [2]. Nothing records a columnstore on
  `SdDocumentHeader` or `SdDocumentLog`, and the replica has **no publisher NC indexes** [3]. So
  order aggregates over 92 days may well be full scans. Probe P2 + P6 measure it.
- **The heavy-report precedent is already on this box.** The SAP audit reports run their
  `RetailTrx` date-range aggregates against this replica, with a **1,800 s** command time-out. That
  was widened from 600 s because store-group aggregates "were throwing Execution Timeout Expired on a
  busy quarter" [1]. **Interactive self-service with a 1–2 minute full-year floor is not interactive.**
  The direct-query path is viable only for one day to a few weeks on the columnstore tables. A
  dashboard-speed answer over 92 days or more needs pre-aggregates somewhere.
- **Placement, in brief** (detail in §2): **never inside `POS`**. Derived tables go in either a
  **sibling database on the same instance** (cheapest, but shares the hardware) or a **separate
  on-prem server** (isolates load, costs a host and a copy lag). Which one depends on the headroom
  numbers. That choice is the job of
  [What builds the marts](../../.issues/748-what-builds-the-marts-views-on-the-replica-dbt-into-a-sibling-database-or-a-copy-to-a-columnar-store.md).
- **Callouts are probably missing from the replica.** The `Callout*` tables are recent additions
  to the OMS app database (spec 2952, 2026-10). A table appears on a transactional subscriber only
  once someone adds it as an article to the publication [4]. Probe P2 checks this. If they are
  missing, the dispatch subject area needs a **replication change**, which is a DBA job.

## 2. Where derived objects may live

| | (a) Sibling DB on the same instance | (b) Views or indexed views inside `POS` | (c) Separate on-prem server |
|---|---|---|---|
| **Example** | `POS_Analytics` beside `POS` on `DWPOSREPL03` | `dbo.v_SalesDay` in `POS` | a new SQL Server, ClickHouse or DuckDB host |
| **Survives reinitialisation** | **Yes.** Reinit touches only the subscription DB's articles | Plain views: they stay in the catalogue. **Indexed (schema-bound) views: they break it** (below) | Yes |
| **Needs a DBA** | Yes: `CREATE DATABASE`, a writer login on it, a SQL Agent job for refresh | Yes: DDL rights in `POS`, which the `read` login refuses [1] | To read: no, the existing `read` login suffices. To host: IT (ticket 749) |
| **Needs a replication change** | No | No (plain) / effectively yes (indexed: `@pre_creation_cmd` must stop being `drop`) | No, if it pulls by query. Yes, if it becomes a second subscriber |
| **Load isolation** | **None.** It shares CPU, memory, tempdb and I/O with replication apply | None | **Full.** The replica sees only scheduled, bounded extracts |
| **Freshness** | Refresh cadence (for example every 15 minutes or nightly) on top of replica lag | Live (plain views) | Extract cadence on top of replica lag |
| **Cross-DB constraints** | Indexed views cannot span databases, so rollups are tables refreshed by a job [5] | — | A copy pipeline to build and run (incremental on `TrxDate` / `EntryTime`) |
| **Verdict** | **Viable.** Default if headroom is ample | **Ruled out** | **Viable.** Default if headroom is thin, or on Standard edition |

**Why (b) is ruled out:**
- A subscriber article's table is normally re-created on reinitialisation (`@pre_creation_cmd =
  'drop'`, the default) [4].
- A table that a `SCHEMABINDING` view references **cannot be dropped** while that view exists [5].
  So an indexed view on a replicated table would make the next snapshot fail. The replication
  doc does not say this in so many words; it is an inference from [4] and [5].
- Plain views would survive, but they add nothing a semantic layer doesn't already give. They also
  mean asking a DBA for DDL rights in a database we must treat as disposable.

**A side-risk the same fact exposes:** the replica's NCCI columnstores are not publisher indexes.
They were added on the subscriber, so a `drop`-mode reinitialisation would **silently remove them**.
The 1–2 minute full-year figure would then become a 1B-row rowstore scan. That puts it on the DBA
checklist (§4, item 3).

## 3. What is still unmeasured — the probe pack

[741-replica-probe.sql](741-replica-probe.sql) is read-only and date-bounded. It writes nothing
(not even `#temp`) and runs under the `read` login. It covers each item the ticket asked for:

| Probe | Answers |
|---|---|
| P1 | Edition, engine edition, version. RCSI / snapshot isolation flags (readers blocking the distribution agent). Query Store. Any sibling DB already present |
| P2 | Which in-scope tables are **present or missing** (`Callout*`, `DispatchBoardRelease`, `LoyCustomerFirstPurchase`, …). Row counts. Every index and its type. Key columns on the four big tables. Count of schema-bound objects already in `POS` |
| P3 | `MSreplication_subscriptions` last-agent-write time. Newest-row lag on `RetailTrx`, `SdDocumentHeader`, `SdDocumentLog` |
| P4 | Whether `read` holds `VIEW SERVER STATE` / `VIEW DATABASE STATE` (expected: no. The OMS login is refused it [7]) |
| P5 | If allowed: CPUs, memory, sessions by login and program (*who else hits it*), top waits. If not: deferred to the DBA |
| P6 | Timed aggregates: 1 day, 7 days and 92 days, by store, city and channel, on `RetailTrx` (header), `RetailTrxDetail` (lines), `SdDocumentHeader` (by store × `DocumentSource`, by city × `DocumentType`), `SdDocumentLog` (by store × `ActionType`), and `Callout` if present |

It runs twice: once at a busy hour and once off-hours. Columns used were checked against the
BackOffice models (`RetailTrx.cs`, `SdDocumentHeader.cs`, `SdDocumentLog.cs`, `Store.cs`): `Store`
carries `City`, `Area` and `Country`. Orders have `DocumentSource` and `DocumentType`; tills have
`DocumentType`.

**How to read P6 once it is back** (the thresholds 748 will use):
- 92-day by-store answers in **under about 5 s** on all four tables: direct query through a
  cached semantic layer is enough for v1. Derived tables are optional.
- Columnstore tables are fast but **orders and the log scan for tens of seconds**: pre-aggregate
  those two only (sibling DB or separate server).
- Anything **over about 60 s at a busy hour**, or replication lag that grows while P6 runs:
  separate server, extracts only, and the replica never sees interactive traffic.

## 4. DBA checklist — what only a DBA can answer

1. **Edition** of `DWPOSREPL03`, if P1 is ambiguous, and whether Resource Governor is configured.
2. **Hardware:** cores, memory, storage. What `max server memory` and MAXDOP are set to.
3. **The NCCI columnstores on `RetailTrx` / `RetailTrxDetail`:**
   - Who created them on the subscriber?
   - Are they scripted to be re-created after a reinitialisation (a post-snapshot script, or a runbook)?
   - What is each article's `@pre_creation_cmd`?
4. **Who else hits the replica** besides the SAP audit reports and ticket 1260's door: other
   reports, BI extracts, SSRS, ad-hoc users. What are its busy hours?
5. **Replication latency:** the typical and worst-case latency (tracer tokens from the publisher,
   or Replication Monitor), and whether it has ever fallen behind during heavy reports.
6. **Isolation:** is RCSI on for `POS` on the subscriber? If not, will the DBA turn it on, so
   analytics readers cannot block the distribution agent?
7. **A concurrency test the DBA watches:** four parallel 92-day P6 queries, with Replication
   Monitor open. Does latency move?
8. **Missing articles:** would the DBA add `Callout`, `CalloutBid`, `CalloutEvent` and
   `DispatchBoardRelease` (and any table P2 lists as missing) to the publication? What does
   adding an article cost (a snapshot of only the new articles, or a reinitialisation)?
9. **A sibling database:** may `POS_Analytics` (or a similar name) be created on `DWPOSREPL03`?
   That includes a writer service login, a SQL Agent refresh job, and a size budget.
10. **Grant:** may the `read` login (or a new analytics login) get `VIEW DATABASE STATE` on `POS`,
    so the semantic layer can read Query Store or index usage for its own tuning?

## 5. What we lack (blocks a subject area)

| Gap | Blocks | Fix |
|---|---|---|
| `Callout*`, `DispatchBoardRelease`: probably not articles | Dispatch and callouts | Add the articles (DBA, publisher side) |
| `LoyCustomerFirstPurchase*`: not on the replica [3] | First-purchase / new-customer counts | Add the article, or derive it from `RetailTrx` in the mart |
| No publisher NC indexes on the replica [3] | Fast order and log aggregates | A derived table, or a subscriber-side index the DBA owns (with the same reinit caveat as §2) |
| `Staff.StaffClass` blank estate-wide [2] | Any by-role cut (for example "pharmacist") | Out of v1 unless master data is fixed |
| Placeholder loyalty IDs (`3795407`, `3378`, `1000000004`) [2] | Per-member measures (none are planned: no PII) | Exclude them in the semantic model if a member *count* is ever offered |
| Till clocks dated 2028/2029 [2] | Any open-ended "to date" window | The semantic model caps every window at today |

## 6. Sources

1. BackOffice ticket 1260, *A read-only reach into production*, `## Answer` (2026-08-24): server
   identity, version, `read` role and object grants, the `AuditConnections.QueryTimeoutSeconds = 1800`
   precedent. `C:\Work\DMSCO\BackOffice\.issues\1260-read-only-reach-into-production.md`.
2. BackOffice memory `reference_replica_retailtrxdetail_sales_analysis` (2026-10-22).
3. BackOffice memory `reference_pos_replica_readonly_door` (2026-09-10).
4. Microsoft Learn, [sys.sp_addarticle (Transact-SQL)](https://learn.microsoft.com/en-us/sql/relational-databases/system-stored-procedures/sp-addarticle-transact-sql?view=sql-server-ver17):
   `@pre_creation_cmd` = none / drop / delete / truncate. Adding articles needs a snapshot or a
   reinitialisation, depending on the change.
5. Microsoft Learn, [CREATE VIEW (Transact-SQL)](https://learn.microsoft.com/en-us/sql/t-sql/statements/create-view-transact-sql?view=sql-server-ver17):
   tables in a `SCHEMABINDING` view cannot be dropped while it exists. Schema-bound views
   reference only objects in the same database.
6. Microsoft Learn, [Editions and supported features of SQL Server 2019](https://learn.microsoft.com/en-us/sql/sql-server/editions-and-components-of-sql-server-2019?view=sql-server-ver17)
   and [Resource Governor](https://learn.microsoft.com/en-us/sql/relational-databases/resource-governor/resource-governor?view=sql-server-ver17):
   Resource Governor is Enterprise/Developer only before SQL Server 2025.
7. BackOffice `.issues/assets/3029-probe-4-log-and-locks.sql`, header comment: "the OMS login is
   refused" `VIEW SERVER STATE`.
