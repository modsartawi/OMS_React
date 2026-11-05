---
type: wayfinder-ticket
wayfinder: research
map: 741
status: done
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

## Answer

Resolved 2026-11-03 (AFK research). Full note, with a primary source cited for each claim:
[741-semantic-layer-options.md](../docs/research/741-semantic-layer-options.md).

**Ranked shortlist**

1. **Cube Core, self-hosted.** It is the only candidate that meets every hard constraint off the shelf.
   - **Licence:** Apache-2.0, current version v1.8.18.
   - **SQL Server driver:** the official `mssql` driver, read-only by default.
   - **The AI's query:** a JSON `/load` call naming measures, dimensions, filters and time grain.
     It is the structured query a 734 tool can validate.
   - **Pre-aggregations:** they live in **Cube Store** on our own on-prem host and are filled with
     plain `SELECT … GROUP BY` slices. Nothing is written into `POS`, which fits 742's
     separate-server option.
     - Banned: `original_sql` pre-aggregations, because they write into the source DB.
     - Untested on SQL Server, so not used yet: lambda rollups and rolling windows.
   - **Access control:** `access_policy` hides members and has row-level rules for later. Both are
     in Core.
   - **Reading from BI tools:** a Postgres-wire SQL API that Metabase and Superset can read.
   - **The model:** about 250 lines of YAML for our ~10 measures and ~15 dimensions.
   - **Gaps:**
     - Cube's MCP server and its Power BI DAX API are Cube Cloud only. We write our own MCP tool,
       which 734's design already does.
     - **[unverified]** Cube Store on Windows. Plan a Linux or Docker host.
2. **SSAS Tabular 2019.** The fallback, and it may already be covered by our SQL Server licence.
   - **Strengths:** native in Excel and Power BI, and row-level security on Standard.
   - **Weakness 1:** it speaks only DAX/MDX, so we would own a compiler from structured queries to
     DAX.
   - **Weakness 2:** Standard caps a Tabular model at 16 GB with one partition. It could only import
     748's pre-aggregated marts, never the 1B-row table.

**The trade-off:** Cube fits the AI contract and its model is reviewable in Git, but it is one more
service to run. SSAS fits Excel and Power BI natively, but we would own a DAX compiler and live with
Standard's limits. **Choose SSAS only if** Excel or Power BI turns out to be the primary front end
and the DBA confirms the licence. The Metabase ruling in 744 does not trigger that, so **Cube is the
pick.**

**Ruled out:**
- **dbt MetricFlow:** it has no SQL Server engine, and its Semantic Layer APIs need a paid dbt
  platform plan. `dbt-sqlserver` stays a candidate for building marts in 748.
- **Malloy:** its SQL Server dialect is experimental, merged 2026-10.
- **Lightdash:** no SQL Server support.
- **Wren AI:** the agent writes SQL, its security and audit are commercial, and its engine repo is
  archived.
- **Boring Semantic Layer:** pre-1.0, and no cache was found.
- **Metabase or Superset models as the semantic layer:** no pre-aggregation on SQL Server, and the
  model is locked into the tool.

**What this hands on:**
- **746 (the seam with 744's Metabase):** does the AI query Cube `/load` through the 734 tool and
  then save the view in Metabase as a question over Cube's SQL API? Or does Metabase's own MBQL
  write path (`question_write`) query Cube directly?
  - Either way, there must be **one governed path, not two**.
  - Also settle: an allow-list and audit around `/load`; minting the security-context token; and
    whether `public: false` members disappear from `/meta`.
- **748:** how load splits between Cube Store rollups and sibling-DB marts.
- **749:** add a host for Cube and Cube Store, Linux or Docker.
- **750 (DBA):** confirm the edition and whether SSAS is licensed. This matters only if SSAS is
  revived.
