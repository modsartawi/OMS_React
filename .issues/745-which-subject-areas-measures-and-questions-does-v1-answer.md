---
type: wayfinder-ticket
wayfinder: grilling
map: 741
status: open
blocked-by: —
---

# 745 — Which subject areas, measures and questions does v1 answer?

## Question

What does the v1 semantic model cover?

Pin down:
- **The subject areas, ranked.** Candidates:
  - till sales ("value through our tills", never revenue: 723's caveat);
  - orders by channel;
  - delivery speed and dispatch, including callouts;
  - insurance;
  - loyalty share.
- **The measures and dimensions** of the first one or two areas, each with its exact business
  definition. Examples: closed = `TrxStatus = 1`; returns are `TrxType 110`; BHD × rate → SAR; the
  placeholder loyalty ids are excluded; dates are capped at today.
- **Ten to fifteen real questions** that HQ users ask today and that v1 must answer.
- **What v1 must not answer.**

Use the real questions as the seed of the AI's evaluation set. Reuse spec 734's vocabulary and
D2's tool definitions where they overlap. A measure that also exists as a 734 tool must have **one**
definition.
