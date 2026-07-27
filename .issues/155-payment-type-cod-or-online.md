---
type: wayfinder-ticket
wayfinder: grilling
map: 126
status: open
blocked-by: —
---

# 155 — Payment type: cash on delivery, or paid online

## Question

**Owner-reported gap, 2026-07-27.** Same shape as [154](154-fulfilment-mode-and-store-choice.md) and
found the same way: the CLCN document carries a payment type, and contract v1.0 has no field for it.

- `Cc2DocumentHeaderBuilder.cs:36-38`:
  `PaymentType = ctx.Strategy.ForcesOnlinePayment || !ctx.CashOnDelivery ? Online : CashOnDelivery`.
  An operator radio, with a strategy override (P2E is online-only and hides the picker).
- CC1 `NewOrderController.cs:50` defaults `CashOnDelivery = true` at construction.

🚩 **Why this was easy to miss, and worth recording.** Map 126 says phase 1 is the *"plain CLCN
**cash** order"*. That "cash" is the order **kind** — not Wasfaty, not Nphies, not insurance, not
P2E — and reads as though the payment question is already settled. It is a **different axis**:
a plain CLCN order can be cash-on-delivery *or* paid online. The map's own phrasing hid a real
header field for the whole of the charting.

What to settle:

- **Is it in phase 1 at all?** P2E is the only kind that forces online and P2E is out of scope, so
  every phase-1 order is the operator's pick. Shipping the constant `CashOnDelivery` would match
  CC1's default and be wrong the first time a caller pays online.
- **Does it violate note 4?** No amount is involved — this is a *classification* of how money will
  be collected, not a change to how much. It should be a plain header field like `documentSource`,
  not a confirmed verb. Confirm that reading before it ships, because "payment" and "no price-
  affecting power" sit close enough to be worth stating explicitly in the spec.
- **What, if anything, does it interact with?** Cash-on-delivery on a *pick-in-store* order is
  either meaningless or means "pay at the counter" — 154 and this ticket meet there, and one of the
  two must own the combination. Also check whether `Cc2DocumentHeaderBuilder`'s downstream consumers
  (fee, submission, OMS document) branch on it.
- **Where does it live in 135's layout?** It is a header fact, so the chip row — but a chip that
  changes how the caller pays may not read as settled-and-collapsed the way `documentSource` does.

Deliverable: the ruling plus the contract field (additive, §9 minor) for 136 to carry.
