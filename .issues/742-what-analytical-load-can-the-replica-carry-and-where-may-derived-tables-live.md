---
type: wayfinder-ticket
wayfinder: research
map: 741
status: done
blocked-by: —
---

# 742 — What analytical load can the replica carry, and where may derived tables live?

## Question

Can the production read replica (`172.23.27.47` / `POS`) serve **interactive** self-service
queries directly? Where may the marts, rollups and semantic-layer caches we derive from it live?

The answer should cover:
- **The tables in scope** for the likely subject areas:
  - till sales: `RetailTrx`, `RetailTrxDetail`;
  - orders: `SdDocumentHeader` and its document source, plus the delivery document action log;
  - dispatch and callouts;
  - store master data.
  For each, give the row count, which indexes exist (columnstore or not) and the typical latency of
  representative aggregates: one day, one week and 92 days, by store, city and channel.
- **Headroom:**
  - what else hits the replica (reports, ticket 1260's door, BI extracts);
  - its hardware and edition, if the DMVs show them;
  - replication latency;
  - whether a burst of concurrent analytical queries would hurt replication.
- **Where derived objects may live:**
  1. a sibling database on the same SQL instance;
  2. views or indexed views inside `POS`;
  3. a separate on-prem server (SQL Server, or a columnar store such as ClickHouse or DuckDB).
  Say which needs a DBA and which a replication change. A subscriber's schema can be wiped on
  reinitialisation.
- **What we lack:** missing tables or columns that would block a subject area.

Read-only from the corporate network, through the sanctioned `sqlcmd` shape. If the network is
absent, hand the queries to the owner. List the questions only a DBA can answer as a checklist.

## Answer

**Half answered (2026-11-03).** The replica was unreachable from this machine (Parallels NAT
`10.211.55.3`, TCP 1433 closed). The documentation half is settled. The measurements are handed to
the owner as [The owner runs the replica headroom probe and the DBA answers its checklist](750-the-owner-runs-the-replica-headroom-probe-and-the-dba-answers-its-checklist.md).
Full note: [741-replica-headroom-and-derived-tables.md](../docs/research/741-replica-headroom-and-derived-tables.md).
Query pack: [741-replica-probe.sql](../docs/research/741-replica-probe.sql).

- **Nothing derived lives inside `POS`.**
  - The `read` login cannot create anything there.
  - An indexed (schema-bound) view on a replicated table would block the `drop`-mode re-creation on
    the next reinitialisation.
  - Plain views add nothing a semantic layer doesn't already give.
- **Two viable homes remain:**
  - a **sibling DB on `DWPOSREPL03`**: needs a DBA, no replication change, shares the hardware;
  - a **separate on-prem server**: needs an IT host, reads through the existing `read` login,
    isolates load.
  - The headroom numbers decide between them, in 748.
- **Direct interactive query is bounded.**
  - The columnstore tables (`RetailTrx`, `RetailTrxDetail`) can serve days to weeks directly.
  - A full year takes 1–2 minutes, and the shipped audit reports already need a 1,800 s time-out on
    this box.
  - Orders (`SdDocumentHeader`) and the action log (`SdDocumentLog`) have no recorded columnstore.
  - So 92-day-and-up dashboards need pre-aggregates somewhere.
- **The edition is unknown and pivotal.** Resource Governor, the only server-side cap, is Enterprise
  only in SQL Server 2019. On Standard, every guard lives in the semantic layer.
- **Gaps that block a subject area:**
  - `Callout*` / `DispatchBoardRelease` are probably not replicated (dispatch needs new articles,
    which is a DBA job);
  - `LoyCustomerFirstPurchase*` is absent.
- **A side-risk:** the replica's NCCI columnstores were added on the subscriber, so a `drop`-mode
  reinitialisation would silently remove them. This is DBA checklist item 3.
