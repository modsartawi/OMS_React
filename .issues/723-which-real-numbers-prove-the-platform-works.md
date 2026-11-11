---
type: wayfinder-ticket
wayfinder: task
map: 717
status: done
blocked-by: —
---

# 723 — Which real numbers prove the platform works?

## Question

Pull a set of **real, recent KPIs** from the prod replica that prove the platform runs the
business at scale. Then record which numbers are trustworthy enough to show management.

Candidate figures (any comparable figure the replica actually holds is fine):
- stores live, tills on NewPos, transactions or orders per day;
- online order and delivery volume by channel (Hybris, call centre, HungerStation, Deliverect,
  Wasfaty);
- delivery-time distribution, callout acceptance and failed-take rate, donor-request fill rate;
- prescriptions and insurance claims processed, and the Nphies approval rate;
- SAP IDocs posted per day with no manual touch;
- coupons and campaigns redeemed, loyalty members.

The answer should give each figure with its query, date range and caveats. Only aggregates go in;
no customer-identifying data. Mind the known traps: replica sales analytics use the status on the
header, the loyalty placeholder 3795407 must be excluded, and BHD amounts are ×10 (BackOffice
memory `reference_replica_retailtrxdetail_sales_analysis`). Store the figures in
`docs/research/717-proof-numbers.md`.

The replica is read-only and reachable only from the corporate network. If this session cannot
reach it, hand the owner the queries as a checklist and turn this ticket HITL.

## Answer

Numbers, with queries and caveats: [docs/research/717-proof-numbers.md](../docs/research/717-proof-numbers.md). The replica was reachable from this machine, so this ran AFK. Only aggregates were pulled; no customer data left the database. Window: 2026-10-04 to 2026-11-02.

- **Scale:**
  - 965 stores and 2,054 tills trading.
  - About 187 k till sales a day (5.61 M in 30 days; 54.9 M year to date).
  - SAR 469.8 M net till value in 30 days, and SAR 4.86 bn of sales year to date before returns.
- **Orders:** 412 k omni orders in 30 days, about 13.7 k a day.
  - 51.7 % own app and web.
  - 20.2 % HungerStation.
  - 17.5 % insurance platform.
  - 9.6 % call centre.
  - Deliverect carried 0 orders in the window.
- **Prescriptions and insurance:**
  - 2.69 M Wasfaty e-prescriptions fetched (about 90 k a day, 950 stores).
  - 134 k NPHIES-linked sales.
- **Loyalty:**
  - 72.5 % of sales are identified to a loyalty member.
  - 2.19 M members bought in 30 days.
  - 14.86 M members on file.
- **Caveats:**
  - "Net till value" is not audited revenue.
  - Our online share is not like-for-like with Nahdi's digital share.
  - There is no NewPos traffic.
- **Not measurable on the replica:**
  - Delivery speed: the delivery milestone columns are empty there.
  - Callouts, donor requests, the IDoc rail and engine coupons: these tables are not replicated.
  - These moved to a new ticket: [What do the production OMS databases say about delivery speed and dispatch?](727-what-do-the-production-oms-databases-say-about-delivery-speed-and-dispatch.md)
