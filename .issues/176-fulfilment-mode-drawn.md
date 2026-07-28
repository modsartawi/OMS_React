---
type: wayfinder-ticket
wayfinder: prototype
map: 126
status: open
blocked-by: 175
---

# 176 — Fulfilment mode, drawn where the agent asks the question

## Question

**Owner gap review #2, 2026-07-28**: *"I don't see where we can choose the delivery type (Pick In
Store or Delivery)."* They are right, and the reason is not that it was forgotten twice.

The state of play:

- [154](154-fulfilment-mode-and-store-choice.md) **ruled both modes into phase 1** on 2026-07-27 —
  contract **v1.1**, `setFulfilment`, flippable while `status: open`, the flip never moving the plant,
  pickup hiding the address and the slot and forcing the fee to 0. Fixture
  [09](assets/136-cc-contract/09-fulfilment-flip.json) carries the exchange.
- Spec [160](160-callcenter-console-spec.md) **carved 154 out** of the build and says so out loud
  ("this spec assumes the delivery, cash-on-delivery defaults"), so tickets 161–174 built a console
  with no mode axis at all: `header-chips.ts:67-75` draws store · slot · source · ref and nothing else.

So the wire is settled and the **surface is simply undrawn** — the same shape
[159](159-coupon-and-loyalty-signup-drawn.md) is in. What is left is a drawing job with real
consequences, because the mode changes what the rest of the screen *is*:

- **Where does the control live?** It is not a settled-then-collapsed fact like the source chip —
  it is asked at the top of the call and can be flipped at any point, and 135's chip row is a row of
  things that are *done*. A fifth chip, a segmented control above the chips, or part of the customer
  rail beside the address are three different claims about how often it is touched.
- **What does the flip do to the screen the agent is looking at?** Under pickup the address block
  (the customer rail's only interactive region) and the slot chip both **disappear**, and the receipt
  loses a line when the fee goes to 0. That is a lot of furniture moving on a console whose one
  winning property is that the furniture never moves (135). Does the region collapse, or stay and
  read as not-applicable?
- **The pickup store picker is the same `setStore` verb** (154), which means it reaches
  [129](129-rebind-store-door.md)'s door and can be **refused** — so the mode control has a failure
  mode, and it needs 135's banner treatment rather than a control that silently does nothing.
- **The retained address.** 154 ruled it hidden-and-kept so a pickup→delivery flip re-derives from
  it. An agent who cannot see it has no way to know a flip back will move the store — the diff arrives
  as a confirmation about a store they never chose. Does the hidden address get a trace?
- **A pickup order has no collection time** — 154's own recorded product gap (`RequiresSlot` is
  delivery-only). Whatever the console draws where the slot chip was must not imply one.

Blocked by [175](175-nothing-enters-an-unaddressed-order.md): if the store becomes something the
agent picks rather than something they are given, the pickup store picker is no longer a special
case — it is the ordinary path — and where the mode sits depends on where the store already sits.

Deliverable: the mode drawn into 135's console as a prototype (this repo's `/prototype` convention,
built inside the real console like 138's was), the layout ruling it settles, and the states it adds
to the spec's acceptance surface.
