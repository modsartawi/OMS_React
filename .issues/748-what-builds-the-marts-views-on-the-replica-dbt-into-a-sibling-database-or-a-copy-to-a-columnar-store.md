---
type: wayfinder-ticket
wayfinder: grilling
map: 741
status: open
blocked-by: 742, 743, 745, 750
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
