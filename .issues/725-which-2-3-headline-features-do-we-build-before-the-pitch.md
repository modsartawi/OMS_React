---
type: wayfinder-ticket
wayfinder: grilling
map: 717
status: done
blocked-by: 724
---

# 725 — Which 2–3 headline features do we build before the pitch?

## Question

Which **2–3 features** do we build and demo live, out of the ranked gap list and the "hidden gems"
from 721?

A feature qualifies only if:
- it builds on what exists rather than starting a new subsystem,
- it can be specified, built and walked on staging in about 3 weeks (pitch around 2026-12-03),
- it lands in front of a named executive: CMO (customer / revenue), CFO (cost), COO (control) or
  CEO (strategy),
- it looks good live: a moment someone in the room remembers.

Candidates to test, which are guesses until 724 resolves:
- an executive command-centre dashboard on live KPIs,
- a single customer-360 / order-journey view across tills, online and aggregators,
- an AI assistant over orders ("why is order X late?"),
- network-wide inventory availability and smart sourcing,
- live delivery tracking for customers.

**Input from the gap matrix (724, decided):**
- The second-ranked gap, the AI copilot with plain-language data questions and MCP, is the market's 2026 differentiator.
- Row 46, a live executive dashboard, is only partly there.
- Callouts with the scorecard and the promotion engine with coupons are expected deployable by 3 December. Finishing either one could itself be a headline feature.
- Raqeeb is gap #1, but it is regulatory and unlikely to look good in a demo. Decide whether it is built before the pitch or only shown on the roadmap.
- The four headline leads are all operations and compliance. A headline feature aimed at the CMO or CFO would balance the room.

The answer names the 2–3 features, the executive each one serves, and one paragraph each that
is enough to start `/to-spec`. Hand each one off immediately (execution override in the map
Notes).

## Answer

Grilled with the owner on 2026-11-03. **Three headline features, one for each part of the room.**

**The cut.** The owner first picked all four candidates. Capacity is **the owner plus Claude agents only**, with about 3 weeks to the pitch, so the owner chose to build three. The **smart sourcing simulator becomes the gap #3 roadmap slide**, with a mock-up at most.

**Raqeeb** (gap #1) is a **roadmap slide only**. It is built on its own compliance track in BackOffice, not in the pitch month.

**Already in flight, not headline builds:** callouts with the scorecard, and the promotion engine with coupons, are expected deployable by 3 December (724). They are demo moments for the headline leads.

**Budget:** each feature is about one spec of 5–8 tickets, run through `/to-spec` → `/to-tickets` → `/implement` AFK loops. Server doors go in BackOffice (SIS.Api); screens go in oms-react.

### 1. Executive command centre — CEO, CFO (and COO)

One read-only oms-react screen with big-screen mode for the meeting room. It shows the business **today**, against the same day last week:
- stores and tills trading;
- till sales and value;
- online orders by channel;
- Wasfaty e-prescriptions and NPHIES sales;
- the share of sales identified to a loyalty member;
- donor requests that saved a sale;
- SAP posting backlog, using the export-console door;
- callout take rate and failed-take rate, once callouts are deployed.

How it works:
- **Data:** aggregates only, served by one cached SIS.Api door (refreshed every few minutes, never computed per click). The till tables are huge (`RetailTrx` ≈ 465M rows), so the spec decides whether a pre-aggregation job feeds the door.
- **Definitions:** KPI definitions are agreed with finance. "Value through our tills" is not "revenue" (723 caveats). Reuse the existing doors where they exist: SAP export console, dispatch scorecard, delivery statistics.
- **Demo moment:** the room watches today's numbers move.

### 2. AI copilot "Ask the OMS" — the moment the room remembers (CEO, COO)

A panel in oms-react that answers plain-language questions from our own data through the Claude API. Two scripted stories:
- *"Why is order X late?"* — explained from its timeline, log and callout events.
- *"HungerStation orders in Riyadh this week versus last?"* — an aggregate.

How it works:
- **Tools, not SQL.** The model calls a **fixed set of read-only SIS.Api tools**: order timeline lookup, KPI aggregates, delivery-delay facts. It never writes free SQL.
- **Data rule (owner ruling): no personal data leaves our servers.** Tools return aggregates or masked results only. Names, mobiles, national IDs and diagnoses are stripped server-side.
- **Server-side control.** The API key stays on the server, and every question and its tool calls are written to an audit log.
- This is gap #2 (market differentiator for 2026).
- **Open for the spec:** IT approval for the API key and outbound traffic from staging and production, and the model choice (use the `claude-api` skill).

### 3. Customer 360 journey — CMO

Extend `loy/member` into one timeline of a member's whole relationship with us:
- till sales;
- app and web orders;
- HungerStation;
- prescriptions (Wasfaty) and insurance;
- coupons and campaigns;
- points earned and burned.

It also shows marketing facts: the first purchase per channel (first-purchase flags are live, LC-03), channel mix, last visit and segment.

How it works:
- Gated by role, with the mobile masked, under PDPL.
- Demoed on a **staff/test member**, so no real customer appears in the room.
- It answers the gap from 724: the four headline leads give the CMO nothing.

Each feature now has a spec ticket on the map:
- [The executive command centre has a ready spec](728-the-executive-command-centre-has-a-ready-spec.md)
- [The AI copilot has a ready spec](729-the-ai-copilot-has-a-ready-spec.md)
- [Customer 360 journey has a ready spec](730-customer-360-journey-has-a-ready-spec.md)
