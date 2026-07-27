---
type: wayfinder-ticket
wayfinder: grilling
map: 126
status: open
blocked-by: —
---

# 157 — Price check: what an item costs, without adding it

## Question

**Owner-added scope, 2026-07-27 — ruled into phase 1.** An agent needs to answer *"how much is X?"*
mid-call without putting X in the basket. Today this is a **till** feature, not a call-center one:
`ItemInfoLookupController` renders `UnitPrice` + `Stock` columns and is constructed in exactly one
place — `POSController.cs:16403`. Neither CC1 nor CC2 reaches it. So this is **new**, not a port.

🚩 **The whole difficulty is [131](131-item-search-endpoint.md)'s note 9, made worse.** The item
search row carries `estimatePriceExVat` — an ex-VAT estimate off the material master, which reads
**~13% under** what the caller pays (`MWST` is a separate 15% condition). That is tolerable on a
search row because the agent is *choosing* an item. It is **not** tolerable here: a price check
exists to be **read out loud**, and an under-quote said aloud is the exact harm 135 amendment 1 was
written to prevent — this time with no basket line beside it to contradict it.

So the question is not "where does the button go", it is **what number a price check may return**:

- **Engine truth or estimate?** A real answer means pricing the item at the order's plant — which is
  what the engine does when you add it. Is there a price-without-add path (a throwaway simulation, a
  `Pricing/Simulate` call, a condition read), and what does it cost under resume-per-request?
  [130](130-potential-bby-prerequisites.md) found `BuildSimulationResult` projects a live transaction
  with no re-price; establish whether an equivalent exists for an item *not* in the basket.
- **VAT-inclusive, always.** Whatever the source, the answer the agent reads must be what the caller
  pays. If only an ex-VAT figure is reachable, the honest surface must say so in words — and per 135
  amendment 1, a figure that is not engine money may not be formatted as money.
- **Does a price check see promotions?** *"How much is X"* has a different answer when X's second
  piece is 70% off. A number that ignores the offer the console is simultaneously advertising
  ([138](138-near-miss-guidance-design.md)) is a contradiction on one screen.
- **Plant-dependency.** The price is the *order's* plant's price. Before a store is bound (154's
  pickup case, or an unattached caller) there may be no plant to price at — say so rather than
  quoting the national price, which is the silent-wrong-price failure 129 found in `ResumeAsync`.
- **Where it lives** in 135's three columns, and whether it is the same surface as
  [158](158-stock-in-other-stores.md) — both are "tell me about this item" and both come off the
  same till controller.

Deliverable: the ruling on the number, the console surface, and any BackOffice contract it needs.
