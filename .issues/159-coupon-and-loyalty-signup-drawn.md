---
type: wayfinder-ticket
wayfinder: prototype
map: 126
status: claimed
blocked-by: —
---

# 159 — The console draws its coupon and its loyalty signup

## Question

**Owner-reported gap, 2026-07-27.** Two features that are already **in phase 1 and already settled**
are drawn nowhere, in [135](135-agent-console-prototype.md)'s console or in
[138](138-near-miss-guidance-design.md)'s host. Unlike 154–158 this is a *drawing* job: no contract
question is open.

### Redeem coupon

- In scope: map note 5 lists `applyCoupon` (`AddCouponAsync`) in the verb list; the contract has
  `POST CallCenterWeb/ApplyCoupon { transactionId, requestId, couponCode }` returning the whole
  `SessionState`, plus `COUPON_REJECTED` (carrying the engine's own reason sub-code) and
  `COUPON_ALREADY_APPLIED` in the taxonomy.
- `grep -i coupon` over `VariantA.tsx` returns **nothing**. There is no entry field, no applied-coupon
  line, and no refusal surface.

What the drawing must settle:

- **Where the entry lives.** A coupon is a header-ish act with a basket-level effect. The chip row
  (settled → collapses to a chip) or the receipt (where its effect appears) both argue for
  themselves, and they are different claims about what a coupon *is*.
- **How an applied coupon reads beside a fired promotion.** Both make the order cheaper and both
  land near the receipt; [138](138-near-miss-guidance-design.md) just spent a whole ticket on how a
  promotion states itself, and a coupon must not read as a fourth near-miss class.
- **`COUPON_REJECTED` carries a sub-code from the engine.** It is a business outcome, not a crash —
  and the agent is on the phone, so the refusal has to be sayable out loud.
- **Rebind interaction, already ruled:** [129](129-rebind-store-door.md) leaves coupons **untouched**
  by a plant rebind (`"C" NewPricingAndKeepManual` keeps the coupon line), while promotion values
  move. So a rebind preview shows promotions changing and the coupon holding — draw that, because a
  coupon that visibly survives a store change is reassuring and one that silently does is suspicious.

### Add new loyalty

- In scope: [132](132-header-capture-inventory.md) ruled it — CC2's create is a **two-step loyalty
  OTP signup collecting country + mobile, then OTP; no name, no email**
  (`CustomerCreateService` / `CustomerCreateSectionVM`). *"Phase 1 keeps all of it; there is nothing
  to build server-side."* Customer **edit** does not exist in CC2 and stays out.
- 135 draws the caller rail with a mobile field and an attached-customer state, but **no signup
  path** — so the console currently has no answer to "this caller isn't in the system".

What the drawing must settle:

- **The OTP step inside a phone call.** The caller reads the code back — so the wait is spoken, not
  silent, and the surface must not steal the whole console while it runs.
- **Where signup sits relative to lookup.** A not-found lookup is the natural entry, and it must not
  read as a failure.
- **The ordering constraint it inherits.** [137](137-callcenter-web-door.md) makes the address book
  unreachable before customer attach — a freshly signed-up caller is attached but address-less, which
  is 135's `attached` state, so the two flows must meet there cleanly.
- 🚩 **Check the door.** 137 gated *loyalty lookup* among its nine routes; confirm the **signup**
  routes (`Loy/*`, branch-scoped OTP) are on `CallCenterWeb/*` too, or the console can find a caller
  it cannot create.

Deliverable: both surfaces drawn into the console prototype (135's variant A / 138's host), with the
states above, plus whatever the door check turns up.
