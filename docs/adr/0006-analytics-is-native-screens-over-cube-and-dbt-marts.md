# Analytics is our own screens over Cube Core and dbt marts, drawn with Recharts

HQ self-service analytics is assembled from four existing pieces, plus our own screens:
- **dbt Core** (`dbt-sqlserver`) builds marts into **`POS_Analytics`**, a sibling database beside
  `POS` on the replica server `DWPOSREPL03`.
- **Cube Core**, self-hosted, is the semantic layer and the **only query engine**. It declares
  the model once and validates every query.
- **SIS.Api** proxies and governs every query. It also keeps every analytics view and board in
  **its own store**.
- **oms-react** draws everything natively, in a new `analytics` area, with **Recharts 3** for the
  charts.

**Metabase, Superset and every BI tool's UI are out of v1.** Nobody signs in to anything but
oms-react.

The AI reaches the model through three new tools in spec 734's one catalogue:
- `describe_model` and `semantic_query`, both read-only, on the panel and on MCP;
- `create_view`, on the panel only. It writes a Personal analytics view to our store and never
  writes to the OMS.

Decided across map 741 (2026-11-03 to 2026-11-05, owner rulings):
- 743: Cube Core;
- 747, 754 and 755: native exploring, full authoring, and our store as the record;
- 746: one governed path and the three tools;
- 748: dbt into `POS_Analytics`;
- 749: the hosting;
- [the Recharts research](../research/741-recharts-for-native-charts.md): Recharts.

Spikes 756 (Cube) and 757 (dbt) ran both tools locally before this record named them. The spec
that builds it is [766](../../.issues/766-hq-self-service-analytics-v1-spec.md).

## Why this shape

- **Nothing analytical is written to `POS`, and no interactive query reads it.** The replica sees
  only bounded, scheduled `SELECT`s from dbt's login. Cube's login reads `POS_Analytics` and
  nothing else. The marts survive a replica reinitialisation, and a stale source fails the run
  closed, so the last good data stays.
- **One definition.** Each measure, dimension and grain, and the no-PII rule, is declared once,
  in the Cube model. The screens, the AI and (at parity) 734's aggregate tools all ask Cube.
  Masking holds by construction: a member that is never declared cannot be queried.
- **Native rendering keeps the house rules:** `t()`, RTL, DMSCO tokens, the colour gates and
  drill-through into OMS screens. An embedded BI tool would break them. Embedded Superset blanks
  its editor and stays LTR under Arabic; embedded Metabase needs Pro and its own sign-on.
- **Our store is the record** for ownership, tiers, revisions and the audit. A BI tool's store
  credits everything to a service account.
- **v1 costs nothing in licences.** Every piece is open source (Apache-2.0 or MIT) and runs
  on-prem, on one Docker host VM on Nutanix with no internet egress.

## Considered and rejected

- **SSAS Tabular** as the semantic layer. It is worth it only if Excel or Power BI becomes the
  primary client.
- **MetricFlow, Malloy, Lightdash and Wren AI.** MetricFlow has no SQL Server support; the others
  failed 743's bar.
- **Cube Store rollups only, with no pipeline.** The owner overruled it in 748.
- **Views on the replica, or a copy to a columnar store.** These are the other two options of 748.
- **Embedded Metabase (Pro) or Superset, and Metabase OSS as the v1 engine.** 747, 754 and 746
  ruled these out, and the owner removed Metabase from v1 entirely on 2026-11-05.
- **ECharts, Nivo and visx** as the chart library (the Recharts research).

## Consequences

- **We own** a definition-to-`/load` compiler and validator in SIS.Api, the analytics store, and a
  thin chart wrapper in oms-react. Recharts has no RTL mode, no loading state and no tables, so the
  wrapper adds RTL, tokens, formats and loading feedback, and tables stay in AG Grid.
- **Every cube is `public: false`, and only views are public.** SIS.Api checks every member
  against `/meta` before `/load`, maps Cube's errors and never passes them through.
- **The analytics store lives in SIS.Api's own backed-up database, never in `POS_Analytics`.**
  That database is rebuildable and carries no backup policy.
- **Changing the model** is a reviewed change to the one BackOffice `Analytics/` tree (dbt and
  Cube together). It ships only when the parity checks and the evaluation set pass (spec 766).
- **Provisional values** may move after the replica headroom probe (750) comes back:
  - the 30 s auto-refresh floor;
  - the 30 s / 10,000-row query caps;
  - no Resource Governor.

  The marts' fallbacks, in order, are a separate SQL Server, then Cube Store rollups (748's
  re-open triggers).
