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

## Not yet specified

- **The saved-view model:**
  - who owns a view;
  - personal versus shared versus HQ-certified views;
  - how an AI-generated view gets promoted to certified;
  - where views are stored (in the BI tool or ours);
  - whether a re-run takes parameters (a date range, a city).
  This depends on the BI tool and on where users explore.
- **Sign-in and identity:**
  - how an oms-react session and its grants reach the BI tool or the semantic layer (SSO, embed
    tokens, service identity);
  - how the audit ties every query to a person.
- **Freshness:** what replica lag and mart refresh cadence users are promised, and how the screen
  shows a figure's "as of" time.
- **Guarding cost and load:**
  - a time-out per query;
  - row caps;
  - concurrency limits on the replica;
  - caching the semantic layer's results.
  This is sized once the replica's headroom is known.
- **Evaluating the AI:** extend 734's D14 evaluation set to queries and views the AI generates.
  How do we score "the right measure, the right filter, the right chart"?
- **Arabic and RTL** in the BI tool's own UI and in AI-generated chart labels, if users explore
  outside oms-react.
- **Who keeps the semantic model:** who adds a measure, and how a change is reviewed.

## Out of scope

- **Row-level security for regional or store managers.** v1 is HQ only (ruling 2026-11-03). Adding
  it later is a new effort.
- **Cloud warehouses or cloud BI.** Everything stays on-prem (ruling 2026-11-03).
- **Any demo for the pitch.** That belongs to [The super OMS pitch](717-the-super-oms-pitch-map.md).
- **Building a query engine, semantic layer or BI tool from scratch.** We assemble existing pieces.
- **Customer-level analytics on personal data.** No PII member exists in the semantic model.
- **Building the stack.** That is `/to-tickets`' job after the spec.
