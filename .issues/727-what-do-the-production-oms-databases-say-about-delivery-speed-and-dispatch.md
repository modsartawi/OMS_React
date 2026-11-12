---
type: wayfinder-ticket
wayfinder: task
map: 717
status: open
blocked-by: —
---

# 727 — What do the production OMS databases say about delivery speed and dispatch?

## Question

The prod replica answered the scale questions in **Which real numbers prove the platform works?**
(723), but it could not give the figures the COO slide needs most. On the replica, the delivery
milestone columns (`SdDocumentHeaderAction.DeliveredTime` / `OutForDeliveryTime`,
`SdDocumentHeaderStatus.DeliveryStatus`) are empty for recent documents. The callout, donor-request,
dispatch-scorecard, SAP IDoc and engine-coupon tables are not replicated at all.

Pull these from the production OMS / HQ databases, through a read-only door the owner sanctions:
- time from order to delivered (median and p90) by channel (app, web, HungerStation, insurance
  platform), and the share delivered the same day;
- callouts per day, take rate, failed-take rate, and how often the search radius widened;
- donor requests raised and filled, with the median time to fill;
- SAP IDocs posted per day with no manual touch, and the error / requeue rate;
- coupon and campaign redemptions by engine.

The answer gives each figure with its query, window and caveats, and adds them to
`docs/research/717-proof-numbers.md` with no customer-identifying data. If no read-only door to
those databases exists, hand the owner the queries as a checklist (this becomes HITL) and record
which figures the pitch will carry without.
