---
type: wayfinder-ticket
wayfinder: grilling
map: 717
status: done
blocked-by: 718, 719, 720, 721
---

# 724 — Where do we lead, match and lag the market?

## Question

Against the combined capability taxonomy (enterprise OMS + pharmacy + delivery rows), where does
our platform **lead**, **match**, **partly cover** or **lack** each capability? Which gaps actually
matter to this business?

The work is to grill the owner row by row on the draft matrix built from 718–721:
- confirm each "us" cell (agents overclaim and underclaim; the owner knows what really runs),
- mark each gap as *matters to us*, *nice to have* or *irrelevant for a GCC pharmacy chain*,
- pick the **3–5 headline "we lead" claims**, where we do what Manhattan or Salesforce cannot do
  out of the box (likely candidates: Nphies/Wasfaty insurance in the order flow, GS1/SFDA batch
  and serial at the scan, donor-store transfers, dispatch callouts with a widening radius, the
  insurance rules engine with back-testing).

The answer is the agreed matrix, published as an artifact, which is also the leave-behind, plus
a ranked gap list. It feeds the headline-feature choice (725) and the narrative (726).

## Answer

Agreed matrix: [docs/research/717-gap-matrix.md](../docs/research/717-gap-matrix.md). It has 54 rows: **13 LEAD · 27 MATCH · 8 PART · 6 LACK**. Grilled with the owner on 2026-11-03.

**Owner facts that changed cells:**
- oms-react **is in production**, used by ops and finance.
- Customer tracking, proof of delivery and status messages are live. Our own fleet uses ours; OTO and HungerStation riders use the partner's.
- These are live: delivery slots capped by capacity, refill reminders, auto-refill (Wasfaty refill), SFDA RSD reporting and self-service order status.
- **Expected live or demo-able by about 3 December:** callouts with the scorecard; the promotion engine with coupons.
- **Not by 3 December:** insurer rules with the playground; prescription sessions. Both are roadmap claims only.

**Headline "we lead" claims.** The owner picked operations and compliance only:
1. Serial and batch on every pack.
2. Donor-store transfers.
3. Callouts with a widening radius.
4. Our own till and OMS on one platform.

The commercial and finance leads (loyalty, Wasfaty/NPHIES at scale, SAP audit trail, settlement) were offered and **declined as headlines**. They stay in the matrix.

**Ranked gaps that matter** (owner took the recommended order):
1. Controlled drugs through Raqeeb (regulatory).
2. An AI copilot, plain-language data questions and agent-ready MCP APIs.
3. Smart sourcing with simulation and "explain why".
4. Cold-chain logging.

All four go on the roadmap. Nine partly-done rows are listed in the matrix as "to be finished", unranked.

**Leave-behind:** the matrix will be published as a page for management with the deck, not now, so it carries the narrative's framing.
