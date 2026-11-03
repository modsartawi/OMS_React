---
type: wayfinder-ticket
wayfinder: research
map: 741
status: open
blocked-by: —
---

# 743 — Which on-prem semantic layer gives an AI a governed query interface over SQL Server?

## Question

Which existing **semantic layer** should hold our measures and dimensions? It must run on our
servers over SQL Server, and it must let an AI ask for data as a **structured query** (measures,
dimensions, filters, time grain), never as raw SQL.

Candidates to assess, at least:
- Cube (Core, self-hosted);
- dbt MetricFlow, the open-source engine. Note which parts of dbt's Semantic Layer API are
  cloud-only;
- Malloy;
- the models and metrics built into BI tools: Metabase, Superset, Lightdash;
- AI-first options that bundle their own layer, such as Wren AI.

For each, give, from primary sources:
- the SQL Server dialect or driver, and whether it is mature;
- whether it self-hosts and under what licence;
- its query API: REST, GraphQL or SQL-over-semantic, and what shape the query takes;
- built-in MCP or AI support;
- caching and pre-aggregation, which matters for the replica's 1B-row tables;
- access control: can it hide a member outright, and does it have row-level security for later;
- which BI tools can read it;
- how big a model with about 10 measures and 15 dimensions is.

End with a ranked shortlist of at most two, and the trade-off between them.
