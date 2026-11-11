---
type: wayfinder-map
status: open
---

# 793 — HQ analytics v2: team reports with parameters, over more sources

## Destination

A **`ready` v2 spec**, handed to `/to-tickets`, that adds three things on top of
[HQ self-service analytics v1](766-hq-self-service-analytics-v1-spec.md):
- **Team sharing:** an author shares a view or board with chosen teams, not with every analytics
  user. The team runs it but does not edit it.
- **Author parameters:** a power user declares the inputs a report takes, with defaults. Viewers
  fill them in at run time.
- **New data sources:** the semantic model grows past v1's four areas, so one report can compare
  figures from several areas.
- **A report:** one saved, parameterised item that holds several charts and tables together with
  the words around them. v1 has only views and boards, so the copilot can only make one view at a
  time.
- **The AI composes a whole report** from one request in the copilot.
- **Scheduled delivery:** a report runs on a schedule and goes by email to named recipients.

No decision blocks the build once the spec is ready. The build starts only after v1 runs on real
data ([The analytics screens call the real doors on staging](784-the-analytics-screens-call-the-real-doors-on-staging.md)).

## Notes

**Charting rulings (owner, 2026-11-06):**
- **Scope:** team sharing, author parameters and new data sources. Regional or store row-level
  security was offered and **not chosen** (see Out of scope).
- **Destination:** a ready v2 spec, the same shape as
  [Self-service analytics with AI](741-self-service-analytics-with-ai-map.md).
- **The motivating case:** a power user builds a complex report that compares figures from several
  sources, saves it, and gives the team access. The team only runs it with different parameters.
- **Scope widened the same day (owner):** reports as a concept, the AI composing a whole report,
  and scheduled email. The owner's worked example is the acceptance case for the spec:
  > "How were sales for each channel yesterday? Focus on two order types, HungerStation and QC,
  > compare them, and show their cancellation rates. The period is a parameter that defaults to
  > yesterday and can be changed. Save it as a report template my team can re-run, schedule it
  > every day by email to named people, and include charts."

  Against v1 the example also needs: a **cancellation rate** measure (the orders area has only
  `orders`), and **QC** as a channel (v1's five channel groups have no QC). Both belong to 796.

**Standing constraints carried from v1** ([ADR 0006](../docs/adr/0006-analytics-is-native-screens-over-cube-and-dbt-marts.md),
spec 766, spec 734). v2 does not reopen them:
- **The stack:** dbt marts in `POS_Analytics`, Cube Core as the only engine, SIS.Api as the gate
  and the store, and oms-react drawing everything with Recharts. On-prem only.
- **No PII member** is ever declared in the semantic model. That includes new areas: loyalty,
  customers and staff are aggregates only, or they are out.
- **The model is changed only by a BackOffice pull request** to the one `Analytics/` tree. Users
  compose from the model; they never extend it.
- The AI writes structured queries only, never SQL. Every AI call is audited.
- The 30 s / 10,000-row caps and the 92-day percentile cap stand until 750 measures otherwise.

**Settled while charting** (agent; the owner may overrule):
- **A SQL editor and user-made joins stay out of v2.** "Comparing several sources" is met by
  cross-area measures the BackOffice team declares in the model, or by panels side by side on one
  board.
  [Does comparing across sources need cross-area measures in one view, or panels side by side?](799-does-comparing-across-sources-need-cross-area-measures-in-one-view-or-panels-side-by-side.md)
  decides which. *Confirmed by 799, which keeps both: panels side by side, plus one curated
  cross-area view.*
- **Board filters are the seed of parameters, not a second mechanism.** v1's six board filters are
  expected to become the built-in parameters, so a board has one strip, not two.
  [What parameters may an author declare, and how do they bind to panels?](797-what-parameters-may-an-author-declare-and-how-do-they-bind-to-panels.md)
  may overrule this with a reason. *Confirmed by 797.*

**Skills:**
- Grilling tickets use `/grilling`, settling minor points as a decision list the owner can overrule.
- Research tickets use `/research`. Notes go in `docs/research/793-*.md` and are linked, never
  pasted.
- Prototype tickets use `/prototype` on a `prototype/793-*` branch.
- Use `/domain-modeling` for new terms. Expect *team* and *parameter*, and how they sit beside
  *tier*, *board filter* and *curator* in `CONTEXT.md`.

**Where the code is:**
- The web half is here (`src/features/analytics/`). The server half is BackOffice
  (`C:\Work\DMSCO\BackOffice`, `Analytics/` and SIS.Api), read-only from this map.
- Teams may reuse the authz roles the Authz admin screen already manages
  (`src/features/admin/authz-admin`).
- Replica queries use the one sanctioned PowerShell `sqlcmd` shape in the BackOffice replica
  memory. Run `Test-NetConnection` first.

## Decisions so far

<!-- the index — one line per resolved ticket -->

- [How do Cube and comparable BI tools model run-time report parameters?](795-how-do-cube-and-comparable-bi-tools-model-run-time-report-parameters.md) — Cube has no parameter concept. SIS.Api resolves each parameter into plain `/load` JSON (filters, date range, measure filter, order + limit, a member chosen from the author's list), extending v1's board-filter merge. Parameters stay out of the JWT, `COMPILE_CONTEXT` and `FILTER_PARAMS`. The BI tools split filters from shape-changing template parameters. Notes: [793-run-time-parameters.md](../docs/research/793-run-time-parameters.md).
- [What parameters may an author declare, and how do they bind to panels?](797-what-parameters-may-an-author-declare-and-how-do-they-bind-to-panels.md) — Seven kinds: period, members, grain, threshold, top N, measure and breakdown. Every one has a default. Parameters are declared on the board or report, never on a view, and bound to panels explicitly, pre-filled to match. A binding that cannot apply is refused at save, never dropped silently. v1's six board filters become the six ready-made parameters, so there is one strip and v1 permalinks still open. SIS.Api resolves the values. New refusal codes `ANALYTICS-411` (declaration) and `ANALYTICS-412` (value).
- [Who is a team when an analytics item is shared, and what may the team do with it?](794-who-is-a-team-when-an-analytics-item-is-shared-and-what-may-the-team-do-with-it.md) — A team is an **audience**, a mix of authz roles and named users, resolved through authz when the item is read. There are still three tiers: a Shared item's audience is `everyone` or a list. Building is a new **author** grant (builder, AI, save, copy, share). A **runner** only runs: parameters, cross-filter, export, permalink. A user outside the audience gets `ANALYTICS-413`.
- [Which document sources and states define QC and a cancelled order?](804-which-document-sources-and-states-define-qc-and-a-cancelled-order.md) — QC is a **delivery type** (`DeliveryDocumentType = 'QC'`, Dawaa Now express via OTO), not a document source, and sits wholly inside `own_app_web`. Cancelled = a terminal close (`C`/`X`/`N`), recorded on the delivery once one exists. There are no reason codes. Who cancelled comes only from the request-close `EntryUser` (`AutoClose` expiry · `PH` till · `Outbox` courier · `BJ_SYSTEM` platform). Match ADR 0081's `ClosedOrCancelled`. Recommended rate: order-dated, all orders as the denominator, cancelled split from expired. HungerStation's platform cancels are not on the replica. Notes: [804-qc-and-cancellation.md](../docs/research/804-qc-and-cancellation.md).
- [How does a scheduled report reach its recipients by email?](803-how-does-a-scheduled-report-reach-its-recipients-by-email.md) — SIS.Api sends through its existing MailKit `IEmailService`, extended for attachments. The body is an HTML email of figures and tables with a link back. Charts are a PDF rendered by headless Chromium from the report print route, and the HTML goes alone if the render fails. One always-running SIS.Api worker with a claim row per slot sends a missed run once, late. Recipients are run-grant holders in the audience, `@al-dawaa.com.sa` only, at most 25. A run uses the owner's rights, and the owner losing the grant suspends the schedule. Notes: [793-scheduled-report-email.md](../docs/research/793-scheduled-report-email.md).
- [Which new subject areas does v2 add, and which HQ questions do they answer?](796-which-new-subject-areas-does-v2-add-and-which-hq-questions-do-they-answer.md) — The baseline is shipped oms-analytics 1.2.0, so items are done. v2 adds, ranked: **orders cancellation and delivery type** (QC is a delivery type, not a channel), **coupons and promotions**, **loyalty aggregates**, and **insurance claims, submitted amounts only**. Margin and SAP/IDoc are out. Cancellation is order-dated: cancelled is split from expired, `N` is left out, and the rate is Σ cancelled ÷ Σ orders. Platform cancels count inside OMS only, with a caveat. Q16–Q31 seed the evaluation. Catalogue: [793-v2-semantic-model.md](../docs/research/793-v2-semantic-model.md).
- [Does comparing across sources need cross-area measures in one view, or panels side by side?](799-does-comparing-across-sources-need-cross-area-measures-in-one-view-or-panels-side-by-side.md) — Both, and nothing generic. **Panels side by side** stay the default. A view in one area may hold **up to 4 named series**, each with its own filters (HungerStation = channel, QC = delivery type). SIS.Api runs one query per series, so rates stay Σ÷Σ, and no total is shown across series. A series does not cross-filter, and a members parameter cannot bind to a dimension a series filters on. Plus **one curated cross-area view, Stores by day** (`store_day`): a dbt mart built with `UNION ALL` and `GROUP BY` at day × store × channel × delivery type. It holds only additive till, orders and delivery figures, each with its own date, plus ratios BackOffice declares. Till gains `delivery_type` through `order_no`. Cube joins two facts nowhere.
- [What is a report, and how does it differ from a view and a board?](801-what-is-a-report-and-how-does-it-differ-from-a-view-and-a-board.md) — A report is **its own item kind**, sharing the board's core: parameters and bindings, audience and tiers, revisions, and the panel query. It reads top to bottom in ordered sections, with no grid, TV mode, auto-refresh or cross-filter. Schedules, the summary and print are the report's alone. **Panels are inline**, owned by the report and optionally copied from a saved view with provenance. No static data tables. Text holds **live figures** the server fills in, and one optional **AI summary** is rewritten every run and number-checked against that run's results, or else dropped. The template is saved. **Sent runs are kept** (a record, plus the HTML and PDF for 90 days), and on-screen runs are recomputed. The CTO demo's frozen copilot report is replaced, not migrated. Not WebI or Stimulsoft: no banded designer, SQL or joins.
- [Which tables do the new areas need, and are they on the replica?](800-which-tables-do-the-new-areas-need-and-are-they-on-the-replica.md) — **Orders and loyalty are ready.** Loyalty's `LoyActivity` has no date index, so the incremental reads an `ActivityId` range. The reconcile key is the till's `Points` payment `RequestId`. **Claims are ready, on `NAuth`/`NAuthLine`** (the Nphies service's table, `ClaimType` 1/4, replicated from `NPDB01`), not `NphiesTrxClaimHeader`. They key to the store at 100 % and to the till at 98 %, are batched about three weeks after the service, and carry their value on the lines. **Coupons are half ready.** The till-side discounts are there now; Coupons V2 and payment discounts are on no publication, so [The DBA adds the Coupons V2 and payment-discount tables to the replica publication](818-the-dba-adds-the-coupons-v2-and-payment-discount-tables-to-the-replica-publication.md) is filed. The till joins an order through `SdDocumentHeader.OrderNo`, not `DocumentNo` (799's owed fact). `order_line_approval_rate` is dropped, because production writes only `A`. Notes: [793-v2-sources-on-the-replica.md](../docs/research/793-v2-sources-on-the-replica.md).
- [How does an author declare a parameter, and a viewer run the report with it?](798-how-does-an-author-declare-a-parameter-and-a-viewer-run-the-report-with-it.md) — Prototyped over three rounds with the owner (branch `prototype/793-parameters`). The designer is **A + B**: an outline on the start side, the report editable in place in the middle, and a fixed inspector on the end side, never a modal. The owner added **undo/redo** (no confirm dialogs), **drag and drop** of sections and blocks, and a **self-checking tutorial** that builds the acceptance case. Declaring a parameter goes kind → link name → label → default (set with the viewer's own control) → pre-filled bindings with reasons. Found a main defect: multi-series bars draw in one colour (SeriesChart).
- [How does the AI compose a whole report from one request?](802-how-does-the-ai-compose-a-whole-report-from-one-request.md) — The AI **builds straight away**, with no plan step. It lists its assumptions and asks only when the words can't be resolved (owner). There is **one copilot, aware of the designer** (owner): with a report open, the panel sends it as the *report in context*, and an AI edit lands as one undo step in the designer and is never saved by the AI. That includes hand-built reports. Otherwise `create_report` saves a Personal report, and follow-ups make new revisions. There are two `panel`-only tools, `create_report` and `edit_report` (a full definition, the designer's validator and pre-fill). A rulebook turns words into shapes: two dimensions make series, one dimension makes a breakdown, "I pick" makes a parameter, and text holds live figures only. The AI never shares, certifies or schedules; it links those steps instead. Author grant only. D14 gains whole-report cases scored on structure.

## Not yet specified

**Destination reached 2026-11-06:** [HQ analytics v2: parameterised team reports, over more sources, composed by the AI and emailed on a schedule](819-hq-analytics-v2-team-reports-with-parameters-spec.md) is `ready`. Every item below was settled in the spec (§C store wire, §B owed rulings, §F settled fog, all as agent rulings the owner may overrule) or carried into its Out of scope. The items are kept here for the record. The only open child is the DBA task 818, which gates coupon redemption measures in the build, not the spec.

- **How the analytics store changes.** Team grants, declared parameters and their saved values
  will change the item shape, `Analytics/Query` and the doors in spec 766 §C. The team half is settled by 794: an audience of role names and user ids, the author grant, and `ANALYTICS-413`. The parameter half is settled by 797: the declarations, the bindings, and a panel query that carries `{item, revision, panel, values}`. 799 adds a view's named series (a label in English and Arabic, plus filters) to the view shape. 801 adds the `report` kind (sections, inline panels with `from` provenance, text with live-figure tokens, one summary block) and a kept **report run** record with a 90-day artefact.
- **Certified items and teams.** Whether certification stays "for everyone" (794 kept it so for now), or a
  certified item can also be scoped to an audience.
- **An owner who loses the author grant.** What happens to the items they own and their audiences. (Their schedules are settled by 803: suspended, not deleted.)
- **Load.** Whether the new areas and parameter-driven re-runs fit 750's caps, or need Cube
  pre-aggregations (none in v1). Since 799, a panel with named series costs one query per series
  (up to 4), and `store_day` is a new mart rebuilt over a 10-day window. 800 measured the new areas' daily replica reads at 5–25 s, except loyalty's date scan (56 s; the incremental avoids it by reading an id range).
- **Saved parameter sets.** Whether a viewer can keep "my store list" as a named preset, or a
  permalink is enough.
- **Feedback from v1 in use.** What HQ actually asks for once 784 runs on real data may reorder the
  candidate areas.

- **Owed facts from 804, minor.** Which account makes the dominant app `DRCL`, so that `cancelled_by` can say "customer". Whether `PH` is production's till user. Neither blocks the spec; the build checks them.
- **Owed rulings from 800, minor, for the spec.** Is a claim dated by `ServiceDate` (it keeps rising for about a month) or by submission? How is an e-commerce redemption (`RDEM`, `PointsAmountInCurrency = 0`) valued: from the matched payment, or from points × rate? Coupon redemption measures land after [The DBA adds the Coupons V2 and payment-discount tables to the replica publication](818-the-dba-adds-the-coupons-v2-and-payment-discount-tables-to-the-replica-publication.md), which blocks the build's coupon measures, not the spec.
- **Beyond submitted claims and redemptions.** 800 corrected one fact: **prior authorisations** carry approved, rejected and partial outcomes, with `Benefit` amounts, as plain columns on `NAuth`/`NAuthLine`, so they need no FHIR parsing. Paid amounts are still absent: `NPaymentNotice`/`NPaymentReconciliation` are stale since 2026-02 and in no publication. Coupons issued against redeemed is the other open figure. Both are revisited only if HQ asks once v2 runs (796).

- **Teaching the designer (owner, 2026-11-06).** A built-in tutorial was asked for and prototyped in 798 as one fixed walkthrough that builds the acceptance case. Open: whether that is enough, or every Certified report gets a "show me how this was built" replay, and who writes the tutorials. Undo/redo in the designer was also asked for (798) and is a spec requirement, not fog.

## Out of scope

- **Row-level security for regional or store managers.** Offered and not chosen (owner,
  2026-11-06). v2 stays HQ only; RLS would be its own effort.
- **A SQL editor, user-made joins and pivot tables** (settled while charting, see Notes).
- **Metabase or any BI tool's own UI.** ADR 0006 stands.
- **Threshold alerts** ("tell me when the cancellation rate passes 5%"). Scheduled email is in
  scope; alerts were not asked for (2026-11-06).
- **Rotating the credentials committed in BackOffice source**, found by 803. It is a security fix for BackOffice, not an analytics decision.
- **Cloud warehouses or cloud BI.**
- **Linked filters** (picking a city narrows the store list) and **top N per series over time**, which needs Cube's preview `rank` or two queries. Ruled out in [What parameters may an author declare, and how do they bind to panels?](797-what-parameters-may-an-author-declare-and-how-do-they-bind-to-panels.md).
- **Margin, cost and profit.** POS has no cost at the time of sale, so a margin would be an estimate at today's cost (owner, 2026-11-06, [796](796-which-new-subject-areas-does-v2-add-and-which-hq-questions-do-they-answer.md)). It returns with a cost-at-sale source, as its own effort.
- **SAP / IDoc export health as an analytics area.** It is an operations concern that the SAP export and sync consoles already serve (owner, 796).
- **Platform-side cancels** (`DhOrderHeader`, `DlvOrderHeader`, which are not on the replica). v2 counts cancellations inside OMS only, with a caveat, and no DBA task is filed (owner, 796).
- **Building v2.** That is `/to-tickets`' job after the spec.
