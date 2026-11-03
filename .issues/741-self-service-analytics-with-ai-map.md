---
type: wayfinder-map
status: open
---

# 741 — Self-service analytics with AI: assembling the stack over the replica

## Destination

The pieces are chosen and the build can start. That means two things exist:
- an **ADR** naming the semantic layer, the BI tool, how marts are built on or beside the replica,
  and how the AI reaches them;
- a **`ready` v1 spec**: the first subject areas, AI-generated queries and views, and saved views
  that users can re-run.

Both are handed to `/to-tickets`. IT has approved the hosting. No decision blocks the build.

## Notes

**Charting rulings (owner, 2026-11-03):**
- **Destination:** the stack ADR plus a ready v1 spec. The stack is not built inside this map.
- **Separate from the pitch.** This effort is not part of the pitch
  ([The super OMS pitch](717-the-super-oms-pitch-map.md), about 2026-12-03). The pitch may show it
  only as a roadmap item. Spec 734's copilot stays the pitch's AI moment.
- **On-prem only.** Every analytics piece runs on our servers. The only outbound call is the model
  call, and it is masked and switchable exactly as in
  [Ask the OMS](734-ask-the-oms-copilot-and-mcp-tools-spec.md) (D3, D4, D9).
- **v1 users are HQ only** (executives and analysts). Every grant holder sees all stores. There is
  no row-level security in v1.
- **The source is the production read replica:** `172.23.27.47` / `POS` (`DWPOSREPL03`), a
  transactional-replication subscriber that answers only on the corporate network.
  - Facts about it are in BackOffice memory: `reference_pos_replica_readonly_door` and
    `reference_replica_retailtrxdetail_sales_analysis`.
  - `RetailTrx` (about 463M rows) and `RetailTrxDetail` (about 1.0B rows) carry NCCI columnstore
    indexes. A full-year aggregate takes 1–2 minutes.
  - The replica has no publisher NC indexes and is missing some tables, for example
    `LoyCustomerFirstPurchase*`.
- **Assemble, don't build.** We adopt existing open-source or licensed pieces. We write only the
  glue: the semantic model, the AI tools and the integration with oms-react. A hand-rolled query
  engine or BI tool is out of scope.

**Standing constraints carried from spec 734:**
- No personal data reaches the model. The semantic model must not even *declare* a PII member:
  name, mobile, email, national ID or iqama, address, coordinates, or a diagnosis.
- The model never writes raw SQL. It writes only structured queries that the catalogue validates.
- Every AI call is audited.

**Skills:**
- Research tickets use `/research`. Notes go in `docs/research/741-*.md` and are linked from the
  ticket, never pasted in.
- Grilling tickets use `/grilling`. Settle the minor points yourself as a decision list the owner
  can overrule (feedback memory).
- Use `/domain-modeling` for new terms. Expect these: semantic model, measure, dimension, view,
  saved view.

**Where the code is:**
- The web half is here.
- The server half is BackOffice (`C:\Work\DMSCO\BackOffice`), which is read-only from this map.
- Queries against the replica go through the one sanctioned PowerShell `sqlcmd` shape in the
  replica memory. Run `Test-NetConnection` first.

## Decisions so far

<!-- the index — one line per resolved ticket -->

- [What analytical load can the replica carry, and where may derived tables live?](742-what-analytical-load-can-the-replica-carry-and-where-may-derived-tables-live.md)
  — Nothing goes inside `POS`. The marts live in a sibling DB on `DWPOSREPL03` or on a separate
  on-prem server. Direct query is fine only on the columnstore till tables, over short windows. The
  edition (Resource Governor) is unknown. `Callout*` is probably not replicated. The measurements
  are owed by
  [The owner runs the replica headroom probe and the DBA answers its checklist](750-the-owner-runs-the-replica-headroom-probe-and-the-dba-answers-its-checklist.md).
- [Which on-prem BI tool lets an AI create views that users save and re-run?](744-which-on-prem-bi-tool-lets-an-ai-create-views-that-users-save-and-re-run.md)
  — First choice is **Metabase**: open source to start, with Pro budgeted for JWT SSO and
  interactive embedding. Second is **Superset**: free, but no RTL, no version history, and its
  SQL Server driver needs work. Lightdash, Evidence and PBIRS are ruled out. The BI tools' own AI
  stays off; our 734 loop creates views through the tool's API or MCP. What the documents claimed
  but nobody ran is owed by
  [A local spike proves Metabase and Superset create a structured view by API and render Arabic](752-a-local-spike-proves-metabase-and-superset-create-a-structured-view-by-api-and-render-arabic.md).
- [Which on-prem semantic layer gives an AI a governed query interface over SQL Server?](743-which-on-prem-semantic-layer-gives-an-ai-a-governed-query-interface-over-sql-server.md)
  — **Cube Core**, self-hosted: Apache-2.0, an official read-only MSSQL driver, and a JSON `/load`
  query the 734 tool validates. Its rollups live in Cube Store on our own host, never in `POS`.
  The fallback is SSAS Tabular, worth it only if Excel or Power BI becomes primary. MetricFlow
  (no SQL Server), Malloy, Lightdash and Wren AI are out. 746 must make Cube and Metabase one
  governed path.
- [Which subject areas, measures and questions does v1 answer?](745-which-subject-areas-measures-and-questions-does-v1-answer.md)
  — v1 has four areas, ranked: till sales, orders by channel, delivery speed, then callouts and
  donor requests.
  - Delivery speed comes from `SdDocumentLog` first events. That corrects 723.
  - Callouts and donors wait on
    [The DBA adds the callout and donor-request tables to the replica publication](753-the-dba-adds-the-callout-and-donor-request-tables-to-the-replica-publication.md).
  - Fifteen HQ questions seed the evaluation set.
  - Nothing per customer, member or staff member, and no revenue.
  - 734's aggregate tools share these definitions.
  - The catalogue is in [741-v1-semantic-model.md](../docs/research/741-v1-semantic-model.md).
- [Do users explore inside oms-react or inside the BI tool?](747-do-users-explore-inside-oms-react-or-inside-the-bi-tool.md)
  — **Native**, and **v1 costs nothing in licences**. HQ users explore in our own oms-react screens
  (a new `analytics` area at `/analytics`, drawn with DMSCO-themed components); **Metabase OSS, the
  free edition**, is the engine behind them, reached over its REST API (`/api/dataset`, `/api/card`),
  with SIS.Api proxying a service credential so there is one login and no per-seat fee. No embedding
  SDK, no iframe. Pro is **not** bought for v1 — only revisited later as an optional power-user tier
  that embeds Metabase's own explorer. Native keeps the zero-literal/RTL/DMSCO rules in force (we
  render everything) and allows drill-through into the underlying OMS record. Viable because v1 is
  curated (745), not open-ended self-serve. AGPL-safe: stock jar, REST at arm's length, internal
  use, frontend never copied. Settled: a `BackOfficeScreen` grant, `/analytics/*`, and `create_view`
  routes to `/analytics/view/:id`. Proven by a five-variant prototype on branch
  `prototype/747-embedded-bi` (screenshots in `.issues/assets/747-shots/`).

## Not yet specified

- **The saved-view model** (now anchored by 747 — views are Metabase OSS cards in its collections,
  rendered natively; what stays fog is the policy):
  - who owns a view;
  - personal versus shared versus HQ-certified views;
  - how an AI-generated view gets promoted to certified;
  - whether a re-run takes parameters (a date range, a city).
- **Sign-in and identity** (747 fixed the shape — SIS.Api holds a Metabase **service** credential
  and proxies the REST calls, so there is one oms-react login and no Metabase login; what stays fog):
  - how an oms-react session and its grants reach the semantic layer (Cube) the same way;
  - how the audit ties every proxied query back to the acting person.
- **Freshness:** what replica lag and mart refresh cadence users are promised, and how the screen
  shows a figure's "as of" time.
- **Guarding cost and load:**
  - a time-out per query;
  - row caps;
  - concurrency limits on the replica;
  - caching the semantic layer's results.
  This is sized once the replica's headroom is known.
- **Evaluating the AI:** extend 734's D14 evaluation set to queries and views the AI generates.
  How do we score "the right measure, the right filter, the right chart"? The seed exists: 745's
  fifteen questions, each with its expected measures, dimensions and filters (§4 of the catalogue).
  The scoring rule is still fog.
- **Arabic and RTL** — largely settled by 747: users explore *inside* oms-react, so RTL is our own
  i18n (proven in the prototype), not the BI tool's. What remains is the Arabic wording of
  AI-generated chart labels and measure names (the model must emit `t()`-keyed or Arabic labels, not
  raw English). The BI tool's own-UI RTL only matters if the optional Pro-embed power-user tier is
  ever added.
- **Who keeps the semantic model:** who adds a measure, and how a change is reviewed.

## Out of scope

- **Row-level security for regional or store managers.** v1 is HQ only (ruling 2026-11-03). Adding
  it later is a new effort.
- **Cloud warehouses or cloud BI.** Everything stays on-prem (ruling 2026-11-03).
- **Any demo for the pitch.** That belongs to [The super OMS pitch](717-the-super-oms-pitch-map.md).
- **Building a query engine, semantic layer or BI tool from scratch.** We assemble existing pieces.
- **Customer-level analytics on personal data.** No PII member exists in the semantic model.
- **Building the stack.** That is `/to-tickets`' job after the spec.
