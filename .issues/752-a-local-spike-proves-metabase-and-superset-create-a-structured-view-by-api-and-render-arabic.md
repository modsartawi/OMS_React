---
type: wayfinder-ticket
wayfinder: task
map: 741
status: done
blocked-by: —
---

# 752 — A local spike proves Metabase and Superset create a structured view by API and render Arabic

## Question

The research behind
[Which on-prem BI tool lets an AI create views that users save and re-run?](744-which-on-prem-bi-tool-lets-an-ai-create-views-that-users-save-and-re-run.md)
ranks Metabase first and Superset second. The notes are
[741-bi-tool-for-ai-views.md](../docs/research/741-bi-tool-for-ai-views.md). Some claims in them
were read from documents but never run (§10 of the notes). Ticket 746 (how the AI creates views)
and ticket 747 (where users explore) should not be decided on claims nobody has run.

Run both tools on this machine and record facts. Use Docker, open-source editions only, and turn
telemetry off. Point each tool at a local SQL Server or a small copy of a sales table. Never point
it at the replica.

1. **Metabase:**
   - Create a saved question with MBQL through `POST /api/card`. Record the minimum payload that
     works.
   - Open its `/question/<id>` link.
   - Is the MCP server available on the open-source edition? Do `question_write` and
     `dashboard_write` work there?
   - Can the raw-SQL tool be switched off for a group?
2. **Superset:**
   - Which image or tag ships the MCP service?
   - Run `generate_chart` with `save_chart=True`. Record the payload and the link it returns.
   - Record the `POST /api/v1/chart/` payload that works.
   - Do charts keep any version history or a personal workspace?
3. **Both tools:**
   - Switch the UI to Arabic and take screenshots of an explore screen and a dashboard.
   - Name a chart, its axis and its legend in Arabic and take screenshots of those.
   - Write down what breaks.
4. **Superset SQL Server:** Does a `pyodbc` + ODBC Driver 18 image connect cleanly?

Record the payloads and the screenshots as assets. Link them from this ticket.

## Answer

**Ruled out of scope, 2026-11-04. Not run.** The map got past this ticket before anyone worked it.
Each of its four questions now concerns something v1 no longer uses:

- **Metabase `/api/card`, MCP `question_write` / `dashboard_write`, the raw-SQL switch (item 1):**
  [755](755-what-can-an-hq-user-author-natively-and-who-may-edit-which-board.md) made our store the
  record and dropped `/api/card` and Metabase dashboards.
  [746](746-how-does-the-ai-generate-queries-and-views-within-spec-734s-tool-catalogue-and-mcp.md)
  then took Metabase out of the v1 query path altogether: Cube is the engine, and Metabase is kept
  only for a later Pro embed tier. `create_view` writes to our store and is never a Metabase card.
- **Superset MCP, `generate_chart`, the chart API, version history (item 2) and its `pyodbc`
  driver (item 4):** [754](754-does-embedded-superset-beat-native-over-metabase-oss-for-hq-exploring.md)
  rejected Superset.
- **Arabic in the BI tool's own UI (item 3):**
  [747](747-do-users-explore-inside-oms-react-or-inside-the-bi-tool.md) made exploring native, so
  oms-react draws every label under our own i18n and RTL rules. The tool's own RTL matters only to
  the optional Pro embed tier, which is not part of v1.

746 had already dropped its `blocked-by: 752` edge for the same reason.

**What carried forward.** The reason for this ticket was that the ADR should not rest on claims
nobody has run. That reason still holds, but it now applies to the v1 engine, Cube Core. That work
moved to the new ticket
[A local spike proves Cube Core answers a governed /load over SQL Server](756-a-local-spike-proves-cube-core-answers-a-governed-load-over-sql-server.md).
If the Pro embed tier is ever revived, it should re-ask items 1 and 3 for Metabase. That would be a
new effort; this ticket would not be reopened.
