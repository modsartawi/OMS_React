---
type: wayfinder-ticket
wayfinder: research
map: 717
status: done
blocked-by: —
---

# 721 — What does our platform do today?

## Question

What does our platform **actually do in production or on staging today**, described as business
capabilities rather than as screens? And which of those capabilities does oms-react show?

The sources are local:
- oms-react `src/features/` (14 areas, roughly 100 features) and `.issues/INDEX.md`.
- BackOffice `CONTEXT.md`, `docs/adr/`, `.issues/INDEX.md` and the auto-memory index. These
  cover NewPos tills, SIS.Api, the SAP IDoc rail, Nphies/Wasfaty/Waseel, the rules engine,
  HungerStation/Deliverect, dispatch callouts and scorecards, donor requests, pick support,
  prescription sessions, GS1 serial and batch checks, coupons, campaigns, loyalty, collection and
  settlement.

The answer should be a capability inventory. For each capability give:
- a one-line business description (no jargon a CFO cannot read),
- its **state**: live, piloting, built but not deployed, or partial,
- the oms-react screen(s) that show it, if any,
- the BackOffice spec or map it came from,
- **"hidden gems"**: strong capabilities with no screen, or with a screen nobody would think to
  demo.

Be honest about state. Many recent specs are merged but marked "SQL owed" or "deploy owed". A
capability we cannot show on staging is not a demo item.

Write the inventory to `docs/research/717-our-capability-inventory.md`. It is the "us" column of
the matrix.

## Answer

Inventory: [docs/research/717-our-capability-inventory.md](../docs/research/717-our-capability-inventory.md) — 127 capabilities in 15 domains, judged from the trackers, ADRs and memory files only. No live system was checked.

| State | Count |
|---|---|
| Live | 25 |
| Piloting | 5 |
| Built, not deployed | 50 |
| Partial | 16 |
| Unverified | 31 |

The 81 rows that are built-not-deployed or unverified must not be claimed as live.

- **Clearly live:**
  - The legacy till fleet with GS1 serial tracking.
  - Hybris online orders.
  - HungerStation on the new SAP rail.
  - The new SAP IDoc pipeline for five channels.
  - Nphies at the till.
  - Cash collection and settlement.
  - Two-step staff login.
  - The till auto-update feed.
  - Nightly first-purchase flags.
  - Al Rajhi Mokafaa.
- **NewPos is only a pilot.** The replica confirms it: there is zero NewPos traffic.
- **Demo-able on staging (proven by a done staging ticket):** materials search, stock check and GS1 check; the SAP export console; the sync console; the HungerStation screens; settlement; delivery and order inquiry.
- **Hidden gems** (15, each matched to an executive in the note), for example:
  - Competed courier callouts with a widening radius and a scorecard.
  - Insurance rules held as data (FHIR), with a playground.
  - The IDoc inspector.
  - GS1 serial and batch control end to end.
  - Donor requests.
  - The basket pricing simulator.
  - The POS Time Machine.
  - First-purchase flags for 12 M members.
- **Open for the owner** (carried into the gap-matrix grilling, 724):
  - Does oms-react run in production, or only on staging?
  - What is the rollout state of about 31 built features?
- **Keep out of any demo:** the KSA96 coupon defects, the Waseel dispense failures (3337), and the SIS.Api connection-pool outage (3338).
