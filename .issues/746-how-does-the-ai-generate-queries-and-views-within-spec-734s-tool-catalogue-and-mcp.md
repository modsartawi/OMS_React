---
type: wayfinder-ticket
wayfinder: grilling
map: 741
status: done
blocked-by: 743, 744
---

# 746 — How does the AI generate queries and views within spec 734's tool catalogue and MCP?

## Question

How does the AI reach the semantic layer and the BI tool, reusing
[Ask the OMS](734-ask-the-oms-copilot-and-mcp-tools-spec.md) rather than standing up a second AI
stack?

Settle these:
- **New catalogue tools.** Which tools join 734's D1 registry? For example:
  - `semantic_query` (structured measures, dimensions, filters and grain, validated against the
    model);
  - `describe_model`;
  - `create_view` (saves a view in the BI tool and returns its link).
  Are they read-only? 734's catalogue "cannot write", but saving a view is a write to the BI tool,
  not to the OMS.
- **Overlap with D2.** Do D2's fixed tools (`orders_by_channel`, `sales_summary`) stay, or move
  onto the semantic layer?
- **Masking.** Is masking still by construction (no PII member is declared), and does D3's scrubber
  also run on semantic results?
- **Limits.** What row caps and time-outs apply per semantic query, and how are they shown in the
  trace?
- **Ways in.**
  - Is the panel (D11) the entry point, or does the BI tool's own UI get an "ask" box?
  - Does MCP (D8) expose the new tools unchanged?
- **The switchable model (D4).** It stays as it is, and the D14 evaluation set extends to queries
  and views.

## Answer (2026-11-04)

Settled as a decision list the owner can overrule (the owner declined the two live questions and
asked to complete — grilling feedback: take my recommendations). **Reconciled against 754 and 755,
which landed concurrently** and moved the ground under this ticket: 755 made **our own store the
record** (Metabase no longer stores cards or dashboards; `create_view` writes a semantic-model-term
definition to our store, not a Metabase card), and both 743 and 755 handed this ticket the
**Cube + Metabase reconciliation**. That reconciliation is decision 1 and is the load-bearing one.

### 1. One governed path: Cube is the v1 query engine; Metabase stays the later-tier engine

The v1 query path is **oms-react → SIS.Api (validate + compile) → Cube Core `/load` → Cube Store
pre-aggregations → the replica marts**. Cube is the single semantic authority: the measures,
dimensions, grains and the no-PII constraint (§2–§5 of the catalogue) are declared **once, in
Cube's schema**. Both the AI's `semantic_query` and the native `/analytics` screens issue the same
structured query to Cube; Cube validates it against the model and serves it from its own
pre-aggregations (off `POS`, per 742/743).

**Metabase is not in the v1 runtime query path.** Each later ticket eroded its role — 755 removed
its store role (no `/api/card`, no Metabase dashboards), native removed its UI role — leaving only
`/api/dataset` as an MBQL runner, which Cube subsumes. So Metabase is **retained, not used in v1**:
it is the documented engine for the *optional later Pro power-user embed tier* (747/754), nothing
more. This is exactly what 755 meant by "an engine-neutral definition keeps 746's Cube + Metabase
path open": the **stored definition format and the SIS.Api compiler are engine-neutral**, so the
same stored view compiles to Cube `/load` today and could compile to Metabase MBQL if that later
tier is ever built. The path stays *open*; v1 does not fork its query engine.

*(Overrulable the other way: if the owner would rather Metabase's `/api/dataset` be the v1 runner
and Cube only the pre-agg/validation layer, the engine-neutral compiler makes that a config of which
backend the compiler targets — but running two query engines in v1 buys nothing native+Cube lacks.)*

### 2. The three new catalogue tools (join 734's one D1 registry)

| Tool | Input | Returns | Write? |
|---|---|---|---|
| `describe_model` | optional subject area | the available measures and dimensions with their labels, grains, and each measure's **shape metadata** (additive · rate · percentile) so the model picks valid ones and never invents a member | read-only |
| `semantic_query` | `{ measures[], dimensions[], filters[], grain, order?, limit?, compareToPrevious? }` | the aggregate result set, validated by Cube against the model; the same `{ tool, input, rows, ms, ok }` trace entry as every D10 tool | read-only |
| `create_view` | a validated `semantic_query` **plus** a chart type and bilingual title | writes the view **definition to our store** (755) as **Personal**, returns `/analytics/view/:ourId` | writes **our analytics store only** |

`describe_model` declares **no PII member**, because none exists in the model (§5) — so it cannot
even advertise one. The flow is: `describe_model` (discover) → `semantic_query` (answer the
question with real numbers) → optionally `create_view` (persist + render natively).

### 3. Overlap with D2 — two tiers now, converge later

734's three aggregate tools (`sales_summary`, `orders_by_channel`, `callout_stats`) **stay as
specified** for the pitch: 734 ships on its own timeline (~Dec 3) reading SIS.Api's own daily
rollup, with **no dependency on the not-yet-built Cube stack**. Once Cube is live and proven at
**parity** (catalogue §6 — each figure *is* the §3 measure), those three tools are **re-pointed to
issue a fixed `semantic_query`** — same tool names and schemas (D1 keeps schemas stable), one
definition in Cube, drift gone. That re-point is a later, test-gated migration, not a v1-of-741
blocker. `order_timeline` / `order_delay_facts` stay outside the semantic model (live single-order
reads, §6), unchanged.

### 4. `create_view` is the one write — and it respects "the catalogue cannot write"

`create_view` writes a definition to **our analytics store**, never to `POS`/OMS — so the standing
invariant (the AI never writes to the OMS) **holds exactly**. Per 755: AI-created views always land
**Personal** to the acting user; promotion to Shared/Certified is a human (curator) act the AI
cannot perform. **The AI creates single views in v1, not boards** — assembling a 12-column board
(755) is a human authoring act; the AI may point at or open a Certified board but not build one.
The chart type `create_view` chooses is validated against the measure's shape metadata (755 Q3: a
rate or percentile measure is never stacked or put in a donut) — the same validator the native
editor uses.

### 5. Masking — by construction, stronger than 734's DTO projection, plus the backstop

- **By construction:** no PII dimension is **declared** in Cube's model, so `semantic_query` cannot
  name one and Cube rejects an unknown member. This is stronger than D3's DTO projection — the field
  does not exist to project.
- **Results are aggregates** (counts, sums, medians, shares), so a PII shape in a result is near
  impossible.
- **The D3 scrubber still runs** on every outbound payload to the model (question + tool results) as
  the cheap backstop — unchanged.
- **Drill-to-detail never shows raw rows on an analytics surface** (755 item 2): it hands off to an
  existing OMS screen under that screen's own grants and masking. So no customer row reaches
  analytics even on a drill.

### 6. Limits — the shape here, the numbers ratified by 750

Each `semantic_query` carries a **row cap on grouped output** and a **per-query timeout shorter than
734's 60 s whole-loop budget** (one query is one of up to 8 tool calls). Both surface in the
**existing** D10 trace schema (`rows`, `ms`) — no new trace field. Provisional values **30 s /
10,000 rows**, which [750](750-the-owner-runs-the-replica-headroom-probe-and-the-dba-answers-its-checklist.md)
ratifies (its busy-hour run already showed ≤ 3.3 s on every 92-day window, Enterprise + RCSI).
**Replica concurrency limits and semantic-layer result caching stay fog** owned jointly with 750 and
the map's "Guarding cost and load" patch — 746 settles the per-query shape, not the fleet sizing.
755's board auto-refresh already adds a server result cache (N screens on one board = one query per
interval), with the 30 s floor provisional on 750.

### 7. Ways in, and MCP

- **The D11 copilot panel is the global AI entry point.** The native `/analytics` screen **also**
  carries an inline "ask" box (747's prototype `ask` variant), wired to the **same** `Copilot/Ask`
  loop and the same D1 tools — one AI stack, two surfaces, never a second stack. The BI tool's own
  UI and its own AI stay **off** (747/754).
- **MCP (D8) exposes the two read tools** — `semantic_query` and `describe_model` — unchanged, so
  **MCP stays strictly read-only** in v1. `create_view` (the one write) is **panel-only** in v1.
  This **amends D1**: the single shared registry gains a per-tool **surface tag** (`panel`, `mcp`);
  read tools are offered on both, the write tool on the panel only. (Overrulable toward the simpler
  invariant — expose `create_view` on MCP too, since it only writes our store and is audited — if
  the owner prefers D1 untouched over "MCP is read-only".)

### 8. The switchable model (D4) and the D14 extension

- **D4 is unchanged.** The loop and the connector don't care what a tool does; the analytics tools
  are just more D1 tools behind the same switchable connector (Claude / Gemini, config-only).
- **D14 extends** with 745's fifteen HQ questions as query/view eval-cases (each already carries its
  expected measures · dimensions · filters in catalogue §4). This **graduates the map's "Evaluating
  the AI" fog into a scoring rule**: a query case passes when **(a)** the requested measures +
  dimensions + filters + grain structurally match the expected spec; **(b)** no number appears that
  the query did not return (carried from D14); **(c)** for a `create_view`, the chosen chart type
  fits the data shape per 755 Q3 (single value → KPI, measure × time → line, ranking → bar/table,
  rate/percentile never donut/stacked). Built with the `claude-api` skill's `build-eval` guide when
  the server half exists.

### 9. Identity and audit (partial fog clearance)

SIS.Api reaches Cube with a **service credential** and proxies every query, mirroring 747's Metabase
proxy. Because v1 is **HQ-only with no row-level security** (every grant holder sees all stores),
Cube needs no per-user security context — SIS.Api is the trust boundary, and the **D6 audit records
the acting user** on every `semantic_query` and `create_view` (channel `panel` or `mcp`). This
clears the Cube half of the map's "Sign-in and identity" fog; the Metabase-SSO half only matters if
the later Pro tier is built.

### What this leaves for `/to-spec` and what stays fog

- **Graduated / cleared:** the three new tools and their read/write split; the one governed query
  path (Cube in v1); the D2 convergence plan; `create_view`'s store-and-tier behaviour; masking; the
  AI entry points and MCP read-only posture; the D14 scoring rule; the Cube half of identity/audit.
- **Still fog (unchanged):** replica concurrency + semantic-layer caching sizing (with 750); the
  promised freshness cadence; the Arabic wording of AI-generated labels (the model must emit
  `t()`-keyed / Arabic labels, not raw English); who keeps the semantic model.
- **Vocabulary:** `describe_model`, `semantic_query`, `create_view` are tool names (not new domain
  terms); 755 already added analytics view / board / Personal-Shared-Certified / curator to
  `CONTEXT.md`.
