---
type: wayfinder-ticket
wayfinder: research
map: 741
status: open
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
