---
type: wayfinder-ticket
wayfinder: research
map: 741
status: done
blocked-by: —
---

# 744 — Which on-prem BI tool lets an AI create views that users save and re-run?

## Question

Which existing BI or exploration tool should hold users' views? It must self-host. A user must be
able to explore, save a view and re-run it. An **AI must be able to create such a view through an
API**, not only through clicks.

Candidates, at least:
- Apache Superset;
- Metabase (open-source and paid editions);
- Lightdash;
- Evidence;
- Power BI Report Server, if we hold the licence (ask the owner; note what it costs).

For each, give, from primary sources:
- **Self-hosting:** the licence, and the features locked behind a paid edition.
- **API creation:** can a saved question, chart or dashboard be created by API? What is the
  payload? Can the AI then hand the user a link to it?
- **Saved views:**
  - personal versus shared collections;
  - parameters or filters at re-run;
  - schedules;
  - version history.
- **Semantic-layer fit:** does it read 743's candidates (Cube, MetricFlow) natively, or only raw
  tables?
- **Embedding inside oms-react:**
  - iframe or SDK, and whether it is signed;
  - theming;
  - which edition embedding needs.
- **Sign-in:** OIDC, SAML or JWT, and whether it can trust a token minted by SIS.Api.
- **Arabic and RTL:** support in the tool itself and in chart text.
- **Its own AI or MCP features:** what exists, and whether any of it phones home. Our on-prem rule
  forbids that unless it goes through our masked connector.

End with a ranked shortlist of at most two.

## Answer

Resolved 2026-11-03 (AFK research). Notes:
[741-bi-tool-for-ai-views.md](../docs/research/741-bi-tool-for-ai-views.md), 52 sources, read
against Metabase v0.65 and Superset 6.x / 7.0.0rc2.

**Ranked shortlist**

1. **Metabase.** Start on the open-source edition and budget for Pro.
   - It has a built-in SQL Server driver.
   - Its saved questions use MBQL, a structured query form, not SQL.
   - Its MCP tools (`question_write`, `dashboard_write`, `execute_query`) save questions and
     dashboards from a structured query. The raw-SQL tool can be switched off per group.
   - It has personal and shared collections, 15 versions of history per item, and an Arabic UI.
   - It reads Cube through Cube's SQL API.
   - **The catch:** Pro or Enterprise is needed for two things: JWT SSO (trusting a token
     signed by SIS.Api) and embedding interactive exploration in oms-react. Pro self-hosted costs
     $6,210 a year plus $130 per user per year beyond 10. Open source embeds only view-only
     guest dashboards and questions, with a banner.
2. **Apache Superset.** No licence cost.
   - It is Apache-2.0 with nothing paywalled, and its embedded SDK and guest tokens are free.
     SIS.Api can sign the guest tokens itself.
   - Its MCP tool `generate_chart` takes a structured config and, with `save_chart=True`,
     returns an `/explore/?slice_id=` link.
   - **The gaps:**
     - I found no personal collections and no version history.
     - It has no RTL layout.
     - SQL Server goes through the unmaintained `pymssql`, so we would build our own image with
       `pyodbc`.
     - Exploring under a SIS.Api identity needs our own Flask-AppBuilder security manager.
     - It cannot read Cube yet. Its MetricFlow support sits behind a flag aimed at 7.0.

**Ruled out**
- **Lightdash:** it has no SQL Server connector. Its licence also checks in with `api.keygen.sh`.
- **Evidence:** views are Markdown files in git built to a static site, so users cannot save a
  view.
- **Power BI Report Server:** reports are authored only in Power BI Desktop. Its REST API can
  upload a `.pbix` but cannot author one, so the AI cannot create a view.
- **Redash:** SQL only.

**Standing consequence:** every BI tool's own AI stays off. That includes Metabot and Lightdash's
agents. Spec 734 D9 allows model calls to leave only from the SIS.Api host. The AI that creates
views is our 734 loop, calling the BI tool's API or MCP. Ticket 746 settles how.

**Open for the owner** (handed to the tickets named):
- **Do we hold PBIRS rights?** This is unanswered, and it does not change the ranking because
  PBIRS fails the AI-creates-views test.
  - Rights come with SQL Server 2025 Standard or Enterprise cores (minimum 4 per server), or with
    Enterprise cores on active Software Assurance before 2025, or with Fabric F64+ or Premium P.
  - Every author also needs Power BI Pro.
  - It would matter only for paginated reports.
- **Is there budget for Metabase Pro, or must v1 cost nothing in licences?** Goes to
  [Do users explore inside oms-react or inside the BI tool?](747-do-users-explore-inside-oms-react-or-inside-the-bi-tool.md).
  Embedding interactive exploration on Metabase forces Pro.
- **Must the BI tool's own UI be Arabic and RTL in v1?** Measured by
  [A local spike proves Metabase and Superset create a structured view by API and render Arabic](752-a-local-spike-proves-metabase-and-superset-create-a-structured-view-by-api-and-render-arabic.md).

**Unverified, and owed to that spike:**
- the exact `POST /api/card` and MBQL 5 shape;
- whether Metabase's MCP server is on the free edition;
- whether the Pro licence check works offline;
- which Superset release ships the MCP service;
- how Arabic and RTL actually render in either tool.
