---
type: wayfinder-ticket
wayfinder: research
map: 717
status: done
blocked-by: —
---

# 720 — What do delivery and quick-commerce dispatch tools offer?

## Question

What do the leading last-mile and quick-commerce tools offer for dispatch, couriers and
aggregator orders? Which of these capabilities should become rows in the comparison matrix?

Tools to look at:
- **Dispatch / last mile:** Onfleet, Bringg, Tookan, Shipday.
- **Aggregator middleware:** Deliverect, Otter.
- **Quick commerce, as seen from the merchant's side:** HungerStation, Talabat, Jahez, Careem
  Quik, Instacart.

Topics to cover: auto-dispatch and courier assignment, broadcast or callout to couriers with a
widening radius, live tracking and ETA, proof of delivery, courier scorecards and SLA tracking,
batching and routing, delivery-time promises, aggregator menu and catalogue sync, aggregator
promotions, and failed or returned delivery handling.

The answer should include those rows with a source for each, plus the 3–5 capabilities the
category leads on that a back-office would demo to show "this is modern".

Write it with `/research` to `docs/research/717-delivery-dispatch.md`.

## Answer

Research note: [docs/research/717-delivery-dispatch.md](../docs/research/717-delivery-dispatch.md) — 35 rows (DL-01…26 dispatch, AG-01…09 aggregators), with 59 sources.

- **What makes a dispatch demo look modern:**
  1. Live tracking with early warnings: a branded tracking page with ETAs, alerts before an order runs late, and driver chat (Onfleet).
  2. Own fleet first, with outside couriers taking the overflow at the cheapest qualified price (Bringg, Deliverect Dispatch).
  3. Delivery slots based on real fleet capacity (Bringg).
  4. Regulated-goods handover: ID check, a PIN and an exportable chain of custody (Onfleet's pharmacy offering).
  5. Aggregator promotions plus a one-click out-of-stock across every delivery app (Otter, Deliverect).
- **Our callout has only one published equivalent.** Tookan's "batch-wise" mode is the only vendor documentation of a search radius that widens in steps.
- **A 1,200-store Jeddah pharmacy chain (likely Nahdi) runs FarEye.** In that setup, drivers can be lent between stores.
- **Nobody publishes cold-chain logging.** It is a gap in the market.
- **Prices (indicative):**
  - Onfleet: $619 to $3,099+ a month.
  - Shipday: $0.06 to $0.25 per extra order.
  - Tookan: tiered per task.
  - Bringg, Deliverect, Grubtech, FarEye and Locus: by quote only.
- **Thin evidence:** the HungerStation partner API sits behind a login, Jahez and Careem Quik have no merchant documentation, and no vendor documents its failed-delivery logic.
