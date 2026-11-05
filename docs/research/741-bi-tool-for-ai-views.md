# 741 / 744 — Which on-prem BI tool lets an AI create views that users save and re-run

> Research for [Which on-prem BI tool lets an AI create views that users save and re-run?](../../.issues/744-which-on-prem-bi-tool-lets-an-ai-create-views-that-users-save-and-re-run.md).
> Written 2026-11-03. `[n]` refers to **Sources**.

Versions read: Metabase docs **v0.65** (v0.64 is the LTS) [2]. Superset **6.x** released, **7.0.0rc2**
the newest pre-release; some features below are on `master` only [23][24]. Lightdash, Evidence and
Power BI Report Server (PBIRS) docs as served today (no version pinned on the pages). "Unverified"
means I could not confirm it from a primary source today.

## 1. Summary

**Ranked shortlist**

1. **Metabase — start on open source, budget for Pro.** It is the only candidate that has all of
   these at once:
   - a mature, built-in SQL Server driver [12];
   - a structured, non-SQL query form (MBQL) for saved questions, and MCP tools that write saved
     questions and dashboards from a structured query (`question_write`, `dashboard_write`,
     `execute_query`) [8][18];
   - personal and shared collections, with 15 versions of history per item [13][14];
   - an Arabic UI (`ar`, `ar-SA`) [11].
   The catch is identity: to trust a token minted by SIS.Api (JWT SSO), and to embed interactive
   exploration in oms-react, Metabase needs **Pro or Enterprise** [2][4]. Pro self-hosted costs
   $6,210 a year, plus $130 per user per year beyond the first 10 [1]. Open source can embed
   view-only "guest" dashboards and questions (with a banner) [3].
2. **Apache Superset — the no-licence-cost alternative.** It is Apache-2.0 with nothing paywalled
   [22]. The embedded SDK and guest tokens are free, and SIS.Api can mint guest tokens itself
   (HS256 shared secret) [25][26]. A built-in MCP service has a `generate_chart` tool that takes a
   structured chart config (dataset id, x, y with aggregate) and can save the chart and return its
   Explore link [27][28]. The costs are in the gaps:
   - no personal-collection model and no revision history that I could find (unverified absence);
   - no RTL layout found; the Arabic translation exists but i18n is off by default [26][30];
   - SQL Server via `pymssql`, whose upstream is unmaintained, so we would build our own image with
     `pyodbc` [33][34];
   - SIS.Api sign-in for *exploring* (not just viewing) means a custom Flask-AppBuilder security
     manager, which is our code [31];
   - the MCP service sits on `master`; I could not confirm which release ships it.

**Ruled out**

- **Lightdash:** it has no SQL Server connector at all [37]. It also needs an enterprise licence
  that calls `api.keygen.sh` on start for embedding, AI agents and MCP [40].
- **Evidence:** its views are Markdown files in git, built to a static site. There is no user
  "save a view", and its AI, scheduling and access control are in the hosted Evidence Studio [46].
- **Power BI Report Server:** reports are authored only in Power BI Desktop, never in the browser.
  There is no Q&A, and no email subscriptions for Power BI reports [49]. The REST API can upload a
  `.pbix`, but nothing can author one [50]. So an AI cannot create a view.
- **Redash:** BSD-2-Clause and revived in 2025, but it has no structured query (SQL only) and
  little momentum [51][52]. One line is enough.

**Top facts that drove the ranking**

1. Lightdash has no SQL Server connector; the only route it offers is through Trino [37].
2. Metabase's MCP tools create saved questions and dashboards, and run *structured* queries keyed
   by table and field id. Raw SQL is a separate tool that can be switched off per group [8].
3. Metabase JWT SSO and SSO embedding are Pro/Enterprise only; open-source embedding is guest
   (view-only) [2][3][4].
4. Superset's whole stack, embedding included, is Apache-2.0. Its MCP `generate_chart` saves a
   chart only when `save_chart=True` and returns `/explore/?slice_id=…` [22][28].
5. Spec 734 D9 allows model egress **only from the SIS.Api host** (see 734). So every BI tool's
   *built-in* AI must stay off, or point at our connector. The AI that creates views is our 734
   loop, which calls the BI tool's API or MCP.

## 2. Metabase (open source, Starter, Pro, Enterprise)

**2.1 Self-hosting and licence**
- AGPL for files outside `enterprise/`. Files inside `enterprise/` are under the Metabase
  Commercial License [17].
- Self-hosted prices [1]:
  - Open source: free, unlimited users.
  - Starter: $1,080 a year, plus $65 per user per year; 5 users included.
  - Pro: $6,210 a year, plus $130 per user per year; 10 users included.
  - Enterprise: from $20,000 a year.
- Paywalled at Pro or above:
  - all SSO (JWT, SAML, OIDC) [2][4];
  - SSO modular embedding [2];
  - custom appearance and whitelabel [16];
  - official collections [14];
  - Remote Sync version control [13];
  - row and column permissions; usage analytics and auditing [1];
  - per-subscription filter values [15];
  - verified content and detailed AI auditing [5].

**2.2 API creation**
- **REST:** `POST /api/card` creates a card of type question, metric or model. The fields are
  `name`, `display`, `visualization_settings`, `dataset_query`, `type`, `collection_id` and
  `description` [18][19].
- **Payload:** `dataset_query` is either native SQL (`type: "native"`) or MBQL, a structured query
  over table and field ids. Metabase converts the classic shape into MBQL 5 on the way in [19].
  So the AI can emit a non-SQL payload.
- **Required fields:** the sources disagree on which fields are required. Check the live OpenAPI on
  our instance (unverified).
- **MCP tools** [8]:
  - `question_write` and `dashboard_write` save content;
  - `execute_query` and `visualize_query` take a structured query, not SQL;
  - `run_saved_question` re-runs a question with parameters;
  - `alert_write` and `subscription_write` create alerts and schedules;
  - `execute_sql` (raw SQL) needs its own scope, a setting, and per-group enabling. We would leave
    it off.
- **Edition and auth for MCP:** the MCP docs name no plan for basic use. Per-group tool control and
  headless JWT access are Pro/Enterprise [7]. MCP authenticates with OAuth 2.0 through Metabase's
  own OAuth server, scoped to the connecting user [7].
- **Deep link:** a saved card has a stable `/question/<id>` URL (not re-read today). The AI can
  return that link.

**2.3 Saved views**
- Personal collections are visible to the owner and admins. Shared collections nest like folders,
  with View or Curate permissions [14].
- History keeps 15 versions per question, dashboard, metric or model, with revert [13].
- Parameters: `run_saved_question` takes parameters [8]. Dashboard filters and editable or locked
  embed parameters also exist [3].
- Schedules:
  - dashboard subscriptions by email or Slack (no plan restriction stated);
  - per-subscription filter values are Pro [15];
  - alerts via `alert_write` [8].

**2.4 Semantic-layer fit**
- **Cube:** Cube lists Metabase as a supported tool. Metabase connects with its Postgres driver to
  Cube's SQL API, and cubes appear as tables [20][21]. The SQL API is off by default in Cube Core and
  must be enabled [20]. Cube's "Semantic Layer Sync" for Metabase is deprecated [20].
- **dbt MetricFlow:** no native connector found (unverified absence).
- **Its own layer:** Metabase's models, metrics, measures and segments are a built-in semantic
  layer, and the MCP tools write them [8].

**2.5 SQL Server**
- Supported "from the oldest supported version … through the latest" (so 2019 is covered), through
  Microsoft's JDBC driver [12].
- Auth: SQL login or Azure AD. Windows/Kerberos auth is not documented [12].

**2.6 Embedding in oms-react**
- **Guest embedding (all plans, open source included)** [3]:
  - web components `<metabase-dashboard>` and `<metabase-question>`;
  - a signed JWT, with editable or locked parameters;
  - light or dark theme;
  - no query builder, drill-through or AI chat;
  - a "Powered by" banner on open source and Starter.
- **Modular embedding with SSO (Pro/Enterprise)** [2]:
  - React SDK or web components;
  - query builder, collection browser and AI chat.
- **Full-app iframe embedding:** uses SSO [2], so in effect Pro.
- **Static (signed) embedding:** deprecated in favour of guest embeds [2].

**2.7 Sign-in**
- JWT SSO is Pro/Enterprise only [4]. Our app signs a JWT with a shared key and posts it to
  `/auth/sso`. Email, name and group claims are configurable, and groups are synced on every login
  [4].
- SIS.Api can play "your authentication app". The docs don't name the signing algorithm, so check
  the SSO examples repo (unverified) [4].
- SAML and OIDC are also paid [2].

**2.8 Arabic and RTL**
- The UI ships Arabic `ar` and `ar-SA` [11].
- The docs say: "While Metabase can support languages that read right to left, the Metabase UI is
  designed around languages that read left to right" [11]. So expect RTL rough edges; we would test.
- Arabic text in chart labels: not documented (unverified).

**2.9 Built-in AI, MCP and phone-home**
- Metabot builds charts from natural language and writes SQL [9].
- Bring-your-own provider needs no paid plan [5]. The providers are Anthropic, OpenAI, Azure,
  Bedrock, Gemini, vLLM, Ollama and others, most with a base-URL override (for example
  `MB_LLM_ANTHROPIC_API_BASE_URL`) [6]. A private-network endpoint needs `MB_LLM_ALLOWED_NETWORKS`
  [6].
- The "Metabase AI service" provider is a cloud call and must not be used [5][6].
- Under 734 D9, Metabot would itself be a second egress point. **Keep it off.** At most, point it at
  an endpoint that SIS.Api's masked connector exposes, if 734 ever offers one (it does not today).
- Telemetry: anonymous tracking is opt-out under Admin > Settings > General [10]. On a paid plan
  there is also a periodic licence-token check that sends counts. The docs don't say whether that
  check can be disabled (unverified) [10].

## 3. Apache Superset

**3.1 Self-hosting and licence**
- Apache-2.0, with no paid edition [22]. Preset is the commercial cloud, out of scope.

**3.2 API creation**
- **REST:** `POST /api/v1/chart/` takes `slice_name`, `viz_type`, `datasource_id`,
  `datasource_type`, `params` (JSON form data) and `query_context`. These fields come from the
  instance's Swagger at `/swagger/v1`; I did not re-read them today (unverified).
- **MCP service:** built in at `superset/mcp_service` [27]:
  - FastMCP; runs with `superset mcp run` or the Docker profile `mcp` on port 5008 [27];
  - chart tools: `generate_chart`, `update_chart`, `get_chart_data`, `get_chart_sql`,
    `list_charts`, `delete_chart` and others [29].
- **`generate_chart` payload** [28]: `{"request": {"dataset_id": …, "config": {"chart_type":
  "xy", "kind": "line", "x": {"name": "order_date"}, "y": [{"name": "revenue", "aggregate":
  "SUM"}]}, "save_chart": true}}`.
  - It is structured and non-SQL. The one SQL escape is a custom `sql_expression` metric.
  - It previews only unless `save_chart=True`.
  - It returns `explore_url` = `/explore/?slice_id=<id>` [28].
- **MCP auth** [27]: `MCP_AUTH_ENABLED` with `MCP_JWT_PUBLIC_KEY` validates a JWT, so SIS.Api
  could mint it. A custom `MCP_USER_RESOLVER` is also possible.
- **Release:** the release notes for 7.0.0rc2 mention MCP only in a security fix [23]. The
  shipping release for the MCP service is unverified.
- **Superset never calls a model itself.** The MCP service only serves external agents [27].

**3.3 Saved views**
- Charts and dashboards have owners, favourites, and draft/published dashboards. There is no
  personal-versus-shared collection model like Metabase's (unverified; from product knowledge).
- Version history: none found (unverified absence).
- Parameters at re-run: dashboard native filters, and `urlParams` / `permalink_key` in embeds [25].
- Schedules: Alerts & Reports behind the `ALERT_REPORTS` flag, which needs Celery and a headless
  browser (unverified today).

**3.4 Semantic-layer fit**
- SIP-182 adds external semantic layers as "semantic views", behind a `SEMANTIC_LAYERS` flag
  targeted at 7.0 [32].
- Built so far: Snowflake Semantic Views and dbt MetricFlow, described as "shipping on Preset". It
  is unclear whether they are in open source [32].
- Cube is "a well-scoped extension for someone to write", so it is not built [32].
- Fallback: Cube's Postgres-wire SQL API through Superset's Postgres driver. Cube no longer lists
  Superset [21], so this is unverified.
- Guest tokens cannot enforce RLS clauses on semantic views [24]. That is moot in v1, which has no
  RLS.

**3.5 SQL Server**
- The docs give `mssql+pymssql://`, and `pyodbc` is also supported [33].
- Microsoft says `pymssql` is no longer maintained and points to `mssql-python` [34].
- Plan for a custom image with ODBC Driver 18 plus `pyodbc`. Official images don't bundle the
  drivers (community report, unverified).

**3.6 Embedding in oms-react**
- `@superset-ui/embedded-sdk` `embedDashboard()` inserts an iframe [25].
- Our backend gets a guest token from `/api/v1/security/guest_token/` with a service account, or
  signs it directly with `GUEST_TOKEN_JWT_SECRET`.
  - Algorithm: HS256 [26].
  - Default lifetime: 5 minutes [26].
  - Feature flag: `EMBEDDED_SUPERSET` [24][25][26].
- What it embeds: dashboards only through the SDK. Single charts embed via a permalink with
  `standalone=1` [24].
- Guests cannot use SQL Lab or ad-hoc queries [24]. So in-app *exploring* needs a real Superset
  session, not a guest token.
- Theming: `themeMode` default/dark/system, plus admin-set themes [25][26].
- Allowed domains are set per dashboard [24].

**3.7 Sign-in**
- Flask-AppBuilder offers DB, LDAP, OAuth, REMOTE_USER and SAML. OpenID 2.0 was removed [31].
- To trust SIS.Api's own JWT, we would write a `CUSTOM_SECURITY_MANAGER` or a REMOTE_USER front
  proxy [26][31]. This is glue code we own.
- A community report says RS256 access tokens were rejected by the API (unverified).

**3.8 Arabic and RTL**
- An `ar` translation directory exists [30].
- `config.py` ships `LANGUAGES = {}`, so i18n is off by default "as translation in most languages
  are" incomplete [26]. We would turn it on.
- No RTL support found [26]. Arabic chart labels: unverified.

**3.9 AI and phone-home**
- No built-in LLM. Only the MCP server [27].
- Telemetry: a Scarf pixel, on by default. Opt out with `SCARF_ANALYTICS=false` [26].

## 4. Lightdash

- **Licence:** MIT, except `packages/backend/src/ee`, which has its own licence [35].
- **Self-hosted enterprise features** need `LIGHTDASH_LICENSE_KEY`, validated against
  `api.keygen.sh` on start. These features are AI agents, MCP, embedding, custom roles, SCIM and
  service accounts [40].
- **Enterprise SSO** covers Okta, Azure AD, OneLogin and generic OIDC [40]. The self-host SSO page
  lists the same providers without a licence note, so this is ambiguous [38].
- **SQL Server: not supported.** The connectors are BigQuery, Postgres, Redshift, Snowflake,
  Databricks, Trino, ClickHouse, DuckDB and Athena. For anything else the only route is Trino [37].
  **This alone rules it out.**
- **API creation:** charts-as-code. `lightdash download` and `lightdash upload --force` move YAML
  checked against `chart-as-code-1.0.json` [39]. A saved-chart REST API also exists (endpoint not
  re-read; unverified).
- **Semantic layer:** Lightdash reads the dbt project's YAML. Dimensions and metrics are declared
  in dbt `schema.yml`, and Lightdash compiles the manifest (from product knowledge).
  - MetricFlow metrics are translated from the compiled manifest, with **no dbt Cloud needed** on
    the CLI route [44].
  - The dbt Cloud Discovery API route is cloud-only [44].
  - No Cube support found.
- **Embedding:** JWT signed with an embed secret. iframe or React SDK, for dashboards, charts and
  AI agents [43]. On Cloud it is a paid add-on [36][43].
- **AI:** AI agents call OpenAI (default `gpt-5.2`), Anthropic, Azure, OpenRouter or Bedrock
  directly from the Lightdash server [41]. Under 734 D9 that is a second egress point.
- **Telemetry:** RudderStack is on by default. Disable it with `RUDDERSTACK_ANALYTICS_DISABLED=true`
  and `LIGHTDASH_DISABLE_UPDATE_CHECK=true` [42]. The roadmap fetch from `roadmap.lightdash.com`
  [40] and the keygen check are extra calls.
- **Arabic UI:** not found (unverified).

## 5. Evidence

- **Licence:** MIT ("Evidence Core") [45][46].
- **How views work:** reports are Markdown plus SQL in a repo, built to a static site we can
  self-host [46]. An AI could write a `.md` file and open a PR, but a user cannot "save a view" in
  the UI. A re-run is a rebuild.
- **Paywalled in hosted Evidence Studio:** the editor, scheduling, access rules, embedding and the
  Evidence Agent [46].
- **SQL Server:** a connector exists [47].
- **Not documented** for the self-hosted static site: SSO and parameters [46].
- **Verdict:** wrong shape for "explore, save, re-run".

## 6. Power BI Report Server

- **Licensing** [48]:
  - core-based;
  - with **SQL Server 2025**, PBIRS may run on cores covered by SQL Server **Standard or
    Enterprise** core licences, minimum 4 per OSE;
  - for SQL Server Enterprise **before 2025**, only Enterprise core licences **with active Software
    Assurance**, and the right lapses with SA;
  - or via **Fabric F64+ reserved instances** or Power BI Premium **P** SKUs; not EM SKUs, and not
    F SKUs below F64.
- **Publishing:** needs a Power BI Pro licence per author. Viewers need none [48].
- **Cost shape:** free if we already own qualifying SQL Server core licences (and SA, for pre-2025
  Enterprise). Otherwise it is a SQL Server core purchase or an F64 capacity. **Owner question.**
- **No AI-created views** [49][50]:
  - reports are built only in Power BI Desktop for Report Server; there is no browser authoring;
  - no Q&A, quick insights, dashboards, data alerts, or email subscriptions for Power BI reports.
    Paginated reports can be subscribed;
  - the REST API manages catalogue items and can upload a report. There is no way to author a
    `.pbix` from a structured payload.
- **Arabic, RTL and SSO:** not researched further, since it fails the core requirement.

## 7. Comparison

| | Metabase | Superset | Lightdash | Evidence | PBIRS |
|---|---|---|---|---|---|
| Licence | AGPL + commercial `enterprise/` [17] | Apache-2.0 [22] | MIT + `ee` licence [35] | MIT [45] | Commercial [48] |
| SQL Server 2019 | Built-in JDBC [12] | pymssql/pyodbc, own image [33][34] | **None** [37] | Yes [47] | Native |
| AI creates a saved view by API | Yes: `POST /api/card`, MCP `question_write` [8][18] | Yes: `POST /api/v1/chart/`, MCP `generate_chart` [28] | Yes, as code [39] | Files in git only [46] | **No** [49][50] |
| Structured (non-SQL) payload | MBQL [19] | Chart config / form data [28] | Chart YAML [39] | No (SQL in md) | — |
| Deep link back | `/question/<id>` (unverified) | `/explore/?slice_id=` [28] | Yes (unverified) | Page URL | — |
| Personal + shared | Yes [14] | Owners only (unverified) | Spaces (unverified) | No | Folders |
| History | 15 versions; Git sync is Pro [13] | None found | Yes, plan unclear [36] | Git | No |
| Schedules | Subscriptions + alerts [8][15] | Alerts & Reports (flag) | Pro/Ent [36] | Studio [46] | Paginated only [49] |
| Cube / MetricFlow | Cube via SQL API [20]; own models | SIP-182: MetricFlow, 7.0, flag [32] | MetricFlow from manifest [44] | — | — |
| Embed in React | Guest (OSS, view-only) [3]; SSO SDK = Pro [2] | SDK + guest token, free [25] | Enterprise licence [40][43] | Static site | iframe (unverified) |
| Trusts SIS.Api JWT | JWT SSO, **Pro** [4] | Custom security manager (our code) [31] | Embed JWT; OIDC [38][43] | — | — |
| Arabic / RTL | `ar`, `ar-SA`; LTR-first UI [11] | `ar` exists, off by default; no RTL [26][30] | Not found | Not checked | Not checked |
| Built-in AI | Metabot, BYO model, OSS [5][6] | None; MCP only [27] | Agents, licence + direct LLM [41] | Studio only [46] | None [49] |
| Phone-home to disable | Anon tracking; paid licence check [10] | Scarf pixel [26] | RudderStack, keygen, roadmap [40][42] | Not checked | — |

## 8. Trade-off between the two

- **Identity and embedding:**
  - Metabase trades money for fit. Pro gives SIS.Api-minted JWT SSO and in-app exploration in
    oms-react with no code of ours.
  - Superset gives guest-token dashboards for free. In-app *exploring* under a SIS.Api identity is
    our own security-manager code.
- **The view model:**
  - Metabase has the richer saved-view model: personal versus shared collections, history,
    parameters on re-run, and subscriptions. This maps onto the map's open "saved-view model"
    question (personal / shared / HQ-certified). "Certified" fits official collections and
    verified items, which are Pro [14].
  - Superset's view model is thinner.
- **The AI path:** both expose a structured, non-SQL creation path and an MCP server. Metabase's MCP
  covers more (dashboards, subscriptions, structured `execute_query`). Superset's is newer, and its
  release is unconfirmed.
- **Semantic layer:**
  - If 743 picks Cube, Metabase reads it today through the SQL API. Superset's Cube adapter does
    not exist yet.
  - If 743 picks MetricFlow, Superset 7.0's SIP-182 may read it natively (open-source status
    unverified). Metabase would need its own models instead.
- **SQL Server:** Metabase works out of the box. Superset needs a custom image.
- **Licence risk:** AGPL is fine for an internal, unmodified deployment. We would not fork it. Get a
  legal check if we ever patch it.

## 9. Owner questions

1. Do we hold SQL Server licences that carry PBIRS rights? That means Standard/Enterprise cores on
   SQL Server 2025, or Enterprise cores with active SA on earlier versions, or a P / F64+ capacity.
   PBIRS still fails the AI-creates-views test, so this only matters if we want it for printed or
   paginated reports.
2. Is there budget for **Metabase Pro** (about $6,210 a year plus $130 per HQ user beyond 10)? Or
   must v1 be zero licence cost, which points to Superset or to Metabase open source with guest
   embeds and a separate Metabase login?
3. Must users explore *inside* oms-react, or is a link out to the BI tool (its own login, LDAP or
   SSO) acceptable for v1?
4. Do HQ users need an Arabic/RTL BI UI in v1, or only Arabic chart labels inside oms-react?
5. Confirm that the BI tools' own AI (Metabot, Lightdash agents) stays **off**, and that the only AI
   is the 734 loop on SIS.Api (D9 egress).

## 10. Could not verify

- The exact required fields of Metabase `POST /api/card` and its MBQL 5 shape; check `/api/docs`
  on an instance [18][19].
- Whether Metabase's basic MCP server is available on open source (no plan named) [7].
- Whether Metabase's paid licence-token check can be disabled, or works offline [10].
- The Superset release that ships the MCP service. Whether SIP-182 MetricFlow is in open-source
  7.0. Superset chart history and personal workspaces.
- Superset's Cube connectivity through Postgres. Cube's current list omits Superset [21].
- RTL behaviour and Arabic chart labels in Metabase and Superset; this needs a hands-on test.
- The Lightdash saved-chart REST endpoint, its Arabic UI, and whether self-hosted OIDC needs the
  licence.
- PBIRS embedding and SSO; not researched past the disqualifier.

## Sources

1. Metabase pricing — https://www.metabase.com/pricing/
2. Metabase, Embedding introduction (v0.65) — https://www.metabase.com/docs/latest/embedding/introduction
3. Metabase, Guest embedding — https://www.metabase.com/docs/latest/embedding/guest-embedding
4. Metabase, JWT-based authentication — https://www.metabase.com/docs/latest/people-and-groups/authenticating-with-jwt
5. Metabase, AI settings — https://www.metabase.com/docs/latest/ai/settings
6. Metabase, AI providers — https://www.metabase.com/docs/latest/ai/providers
7. Metabase, MCP server — https://www.metabase.com/docs/latest/ai/mcp
8. Metabase, MCP tools — https://www.metabase.com/docs/latest/ai/mcp-tools
9. Metabase, Metabot — https://www.metabase.com/docs/latest/ai/metabot
10. Metabase, Information collection — https://www.metabase.com/docs/latest/installation-and-operation/information-collection
11. Metabase, Localization — https://www.metabase.com/docs/latest/configuring-metabase/localization
12. Metabase, SQL Server connection — https://www.metabase.com/docs/latest/databases/connections/sql-server
13. Metabase, History — https://www.metabase.com/docs/latest/exploration-and-organization/history
14. Metabase, Collections — https://www.metabase.com/docs/latest/exploration-and-organization/collections
15. Metabase, Dashboard subscriptions — https://www.metabase.com/docs/latest/dashboards/subscriptions
16. Metabase, Appearance — https://www.metabase.com/docs/latest/configuring-metabase/appearance
17. Metabase LICENSE.txt — https://github.com/metabase/metabase/blob/master/LICENSE.txt
18. Metabase API reference, card — https://www.metabase.com/docs/latest/api/card
19. Metabase, Set up Metabase from code with the API — https://www.metabase.com/articles/set-up-metabase-from-code-with-the-api
20. Cube, Metabase integration — https://docs.cube.dev/admin/connect-to-data/visualization-tools/metabase
21. Cube, Visualization tools — https://docs.cube.dev/admin/connect-to-data/visualization-tools
22. Superset LICENSE.txt — https://raw.githubusercontent.com/apache/superset/master/LICENSE.txt
23. Superset releases — https://github.com/apache/superset/releases
24. Superset, Embedding (Next docs) — https://superset.apache.org/user-docs/using-superset/embedding
25. Superset embedded SDK README — https://raw.githubusercontent.com/apache/superset/master/superset-embedded-sdk/README.md
26. Superset `config.py` (master) — https://raw.githubusercontent.com/apache/superset/master/superset/config.py
27. Superset MCP service — https://github.com/apache/superset/tree/master/superset/mcp_service
28. Superset MCP `generate_chart.py` — https://raw.githubusercontent.com/apache/superset/master/superset/mcp_service/chart/tool/generate_chart.py
29. Superset MCP chart tools directory — https://github.com/apache/superset/tree/master/superset/mcp_service/chart/tool
30. Superset translations directory — https://github.com/apache/superset/tree/master/superset/translations
31. Flask-AppBuilder, Security — https://flask-appbuilder.readthedocs.io/en/latest/security.html
32. Preset, Semantic layers in Superset (2026-08-06) — https://preset.io/blog/semantic-layers-in-superset/
33. Superset 6.0.0 docs, databases — https://apache.googlesource.com/superset/+show/HEAD/docs/versioned_docs/version-6.0.0/configuration/databases.mdx
34. Microsoft, mssql-python support lifecycle (pymssql status) — https://learn.microsoft.com/pt-pt/sql/connect/python/mssql-python/support-lifecycle?view=sql-server-2017
35. Lightdash LICENSE — https://github.com/lightdash/lightdash/blob/main/LICENSE
36. Lightdash pricing — https://www.lightdash.com/pricing
37. Lightdash, Connect a project — https://docs.lightdash.com/get-started/quickstart/connect-project
38. Lightdash, SSO for self-hosted — https://docs.lightdash.com/self-host/customize-deployment/use-sso-login-for-self-hosted-lightdash
39. Lightdash CLI reference — https://docs.lightdash.com/references/lightdash-cli
40. Lightdash, Self-host enterprise features — https://docs.lightdash.com/self-host/enterprise-features
41. Lightdash, Self-host AI agents — https://docs.lightdash.com/self-host/enterprise-features/ai-agents
42. Lightdash, Environment variables — https://docs.lightdash.com/self-host/customize-deployment/environment-variables
43. Lightdash, Embedding reference — https://docs.lightdash.com/references/embedding
44. Lightdash, dbt MetricFlow — https://docs.lightdash.com/integrations/dbt/metricflow
45. Evidence GitHub README — https://github.com/evidence-dev/evidence
46. Evidence docs home — https://docs.evidence.dev/
47. Evidence, SQL Server data source — https://docs.evidence.dev/core-concepts/data-sources/mssql
48. Microsoft, What is Power BI Report Server (licensing) — https://learn.microsoft.com/en-us/power-bi/report-server/get-started
49. Microsoft, Compare PBIRS and the Power BI service — https://learn.microsoft.com/en-us/power-bi/report-server/compare-report-server-service
50. Microsoft, PBIRS REST APIs — https://learn.microsoft.com/en-us/power-bi/report-server/rest-api
51. Redash GitHub — https://github.com/getredash/redash
52. Redash discussion on 2025 releases — https://github.com/getredash/redash/discussions/7335
