---
type: spec
status: ready
---

# 412 — A qualified promotion names the reward it is waiting for (get-side shortfall guidance in the call center)

Settled in the 2026-10-03 grilling that began as *"the coupon was redeemed but no promotion applied,
while the same promotion worked on NewPos"*. The vocabulary is `CONTEXT.md`'s: **bonus buy**, **buy
side / get side**, **reward**, **link category**, **condition target type**, and two terms minted in
that session, **coupon-gated bonus buy** and **get-side shortfall**. The wire is the call-center session
contract (`.issues/assets/136-cc-contract/CONTRACT.md`, live at v1.11). This spec proposes **v1.12,
additive**. Decisions W1–W14 below are this file's own.

**The seam is the contract.** Every server-backed item here depends on BackOffice work that is
**not filed yet** (asks BO-1 to BO-3 under Further Notes). Build and test the web half against a stub
of **exactly** the shape in W2 and W5, and never invent a field beyond it.

## Problem Statement

A call-center agent applies a caller's coupon. The coupon service accepts it, the coupon chip shows
the code, and nothing else changes: no discount, no explanation. The caller is told the coupon worked.
The same coupon on a till gives the discount, so the agent concludes the call center is broken.

Investigation (staging session `06GFECB9F1MGCPEWTB1SGBNWC2`) showed the engine behaved identically
on both doors:

- Coupon `SS222` was redeemed and its campaign material `COUP01` landed on the order, meeting the
  buy side of bonus buy `000100000803`.
- That bonus buy is **Material-targeted** with **two reward arms joined by OR**: 20% off `500061`, or
  10.00 off `500062`. The till basket happened to hold both products. The call-center basket held only
  `208730`. With nothing to reward, the engine records a **get-side shortfall** and gives nothing.

What went wrong is what the agent was told:

1. **The card was false.** The server projects a shortfall as `isReady: true` with no `skipReason`
   (every prerequisite is met, and a shortfall is not a refusal). Because its driving prerequisite is
   the coupon voucher, the console classed it as `needsCoupon` and said *"This offer needs a coupon —
   apply one on the Coupon chip above"*, about a coupon the agent had just applied.
2. **The same lie, worded differently, hits every non-coupon promotion.** "Buy a shampoo, get the
   conditioner at 50%" with only the shampoo in the basket projects as `isReady: true` and is drawn
   as `counted`: *"already counted — a better offer applied"*. Nothing out-ranked it. Its reward simply
   has no product to land on.
3. **A coupon-gated shortfall costs the caller something real.** The code is spent at the coupon
   service the moment it is applied. Until a reward product is added it buys nothing, and nothing on
   screen says which products those are.

## Solution

When a bonus buy has qualified but its get side has nothing to reward, the guidance strip draws a
**shortfall card**, ranked above every other card:

- It says the offer **qualified** and is waiting for a reward product. It never says *ready*,
  *counted* or *needs a coupon*.
- It lists the **reward arms**, one row per arm. Each row gives the product (or the grouping, as *any
  1 of N*), that arm's own discount wording, and whether the arm is already satisfied.
- A header line states the get-side link: **"Add any one"** under OR, **"Add one of each"** under AND.
- Opening an arm resolves its products **at the order's plant**, stock-filtered, ranked and capped by
  the server. Each product has the same **one-click add** the prerequisite card already offers.
- When the offer is coupon-gated, the card says the coupon is **already spent on this order** and
  gives nothing until one of these is added.
- The card disappears on its own when the engine fires the offer. Under AND it stays until the last
  arm is satisfied, showing which arms are done.

Server side, a shortfall stops being reported as *ready*. *Ready* goes back to its one meaning,
*qualified but out-ranked by a better offer*, which also corrects the WPF Check-Offer READY chip.

## User Stories

1. As a call-center agent, I want a promotion that qualified but has nothing to reward to say exactly that, so that I never tell a caller a discount applied when it did not.
2. As a call-center agent, I want the card to name the reward products, so that I can tell the caller what to add to get the discount.
3. As a call-center agent, I want to add a reward product in one click from the card, so that I do not have to search the catalogue while the caller waits.
4. As a call-center agent, I want each reward arm shown with its own discount, so that under OR I can steer the caller to the arm that saves them more.
5. As a call-center agent, I want the card to say "add any one" or "add one of each", so that I know whether one product unlocks the reward or every arm needs one.
6. As a call-center agent, I want an arm I have already satisfied marked as done, so that under AND I can see which arm is still missing.
7. As a call-center agent, I want a grouping arm stated as "any 1 of N", so that I do not mistake a set of products for a single product.
8. As a call-center agent, I want the reward products filtered to what the order's store can actually supply, so that I never offer the caller something that cannot ship.
9. As a call-center agent, I want an unknown stock figure kept rather than hidden, so that a stock outage does not silently shrink the list of reward products.
10. As a call-center agent, I want the list to say when it was capped, so that I do not read the first handful as the whole set.
11. As a call-center agent, I want a coupon-gated shortfall to tell me the coupon is already spent on this order, so that I understand the caller loses it if no reward product is added.
12. As a call-center agent, I want the shortfall card to sit above every other guidance card, so that the offer closest to paying out is the first thing I see.
13. As a call-center agent, I want the shortfall card to disappear on its own once the reward fires, so that the strip never shows a stale instruction.
14. As a call-center agent, I want the fired promotion to then appear with its real money, so that I can confirm the discount to the caller from the engine's own figure.
15. As a call-center agent, I want a coupon chip whose coupon has bought nothing to stay truthful (amount 0), so that the coupon modal and the strip never disagree.
16. As a call-center agent, I want the card never to show a money total or a savings figure, so that the only money I read out is the engine's.
17. As a call-center agent, I want an offer that is genuinely out-ranked still drawn as "already counted", so that the fix does not erase a true statement.
18. As a call-center agent, I want an offer that truly needs a coupon still drawn as "needs a coupon", so that the coupon prompt keeps working where it is right.
19. As a call-center agent, I want an origin- or validity-refused offer still drawn as unavailable, so that I am not sent adding products to an offer that can never fire here.
20. As a call-center agent, I want a one-click add that the server refuses to say why in its own words, so that a refused add never looks like a silent success.
21. As a call-center agent, I want a reward product that is already in the basket to raise the arm's progress, not to appear as a fresh add, so that I do not add a second unit by mistake.
22. As a call-center agent, I want the card to keep working when the order's store changes, so that the reward list is re-resolved at the new store rather than kept from the old one.
23. As a call-center agent, I want an arm whose products are all out of stock at this store to say so, so that I can tell the caller the reward is not available here rather than showing an empty list.
24. As a call-center agent, I want the shortfall card to count in the top bar's offer count, so that the strip and the top bar never disagree about how many offers need attention.
25. As a call-center agent, I want the strip's keyboard behaviour to reach the shortfall card and its add buttons exactly like the existing cards, so that I can work the card without the mouse.
26. As a call-center agent on a console older than the server, I want nothing to break, so that a server shipped first never blanks or mis-draws my screen.
27. As a call-center agent on a new console talking to an older server, I want today's behaviour, so that the console never invents a shortfall the server did not report.
28. As a call-center supervisor, I want coupons to stop being silently wasted on orders, so that customers do not lose single-use codes to an agent's missing information.
29. As a promotions owner, I want a coupon-gated promotion to behave the same on the till and the web, so that the campaign's results do not depend on the channel.
30. As a back-office pricing user on the WPF Check-Offer screen, I want READY to mean only "qualified but out-ranked", so that the chip no longer promises a fire that cannot happen.
31. As a developer, I want the shortfall classification to live in one pure module, so that the strip, the top-bar count and any later surface agree by construction.
32. As a developer, I want the contract amendment recorded with its reasoning, so that the next change to near-misses knows why v1.12 is additive and not a major.

## Implementation Decisions

**W1 — Scope: every get-side shortfall, not only coupon-gated ones.** One state, one cause, and both of
today's renderings of it (`needsCoupon`, `counted`) are false. Only **Material** (`M`) and
**Grouping** (`G`) condition target types can fall short. All-Prerequisites (`P`) and Document (`R`)
rewards land on lines already present, so the server never reports a shortfall for them.

**W2 — The near-miss carries the shortfall (contract v1.12, additive, server-first).** Three optional
fields on each near-miss:

```ts
// proposed v1.12 additions to NearMiss (absent ⇒ not a shortfall; v1.11 behaviour)
getShortfall?: boolean
rewardLink?: 'any' | 'each'            // get-side link category: O ⇒ any, A ⇒ each
rewards?: Array<{
  armId: string                         // the get-side condition's identity; what ResolveReward takes
  kind: 'material' | 'grouping'
  materialNumber?: string               // kind material
  groupingId?: string                   // kind grouping
  eligibleCount?: number                // grouping population, same rule as a prerequisite's
  have: number                          // reward units of this arm already in the basket
  need: number                          // units the arm needs to form (≥ 1)
  discount?: NearMissDiscount | null    // this arm's own definition, through the existing 161 rule
}>
couponsSpent?: string[]                 // typed codes of this order's coupons whose voucher met the buy side
```

`rewards` is present only when `getShortfall` is true. `couponsSpent` is resolved server-side from the
session's coupon ledger, because the client cannot tell which bonus buy a coupon gates.

**W3 — `isReady` is false for a shortfall.** The engine-side "ready" predicate excludes a get-side
shortfall, so *ready* means only *qualified but out-ranked*. This is the one place a v1.11 console
changes behaviour against a v1.12 server: it draws the shortfall as an ordinary actionable card
instead of `counted`, which is the safe direction. Recorded as the amendment's "why not 2.0" note.

**W4 — Classification precedence in the guidance view model.** Precedence becomes: `skipReason`
present ⇒ **unavailable** → `getShortfall` ⇒ **shortfall** (new class) → driving prerequisite is an
*unmet* coupon ⇒ **needsCoupon** → `isReady` ⇒ **counted** → otherwise **actionable**. The coupon
class now also requires the coupon prerequisite to be unmet, so a coupon already on the order can
never produce "needs a coupon".

**W5 — `GET CallCenterWeb/ResolveReward?transactionId=&offerId=&armId=`, a new read.** Its result has
the same shape as `ResolvePrereq`'s, with `armId` and a `reward` descriptor in place of `prereq`:
`{ offerId, armId, reward, items, truncated, topN }`, items are the existing qualifying-item rows. It
follows `ResolvePrereq`'s rules exactly: on demand only, never inline; stock-filtered **at the
order's plant**, ranked, capped at the server's `topN`; `atp: null` on a degraded stock read, never a
non-200; mounted on the call-center door, never `Bby/*`. It refuses with the codes `ResolvePrereq`
already uses when the offer is no longer a shortfall on this order. **No new error code.** A separate
route (not a `side=` flag on `ResolvePrereq`) keeps each door's name true.

**W6 — The shortfall card.** A new card variant in the guidance strip. Headline: the offer's discount
definition, or the server description when absent. A *qualified* statement. The link header (W2
`rewardLink`). One row per arm in `armId` order: subject (material or "any 1 of N" grouping), the
arm's own discount phrase, and a met mark when `have ≥ need`. Expanding an arm runs `ResolveReward`
and lists its rows with the existing one-click add. Satisfied arms do not offer an add.

**W7 — The coupon-spent line.** When `couponsSpent` is non-empty, the card carries one statement
naming the code or codes: the coupon is spent on this order and gives nothing until a reward product
is added. It is a statement with no action. Removing the coupon stays at the coupon chip.

**W8 — Ranking and counts.** Shortfall cards rank **above** actionable cards, in server order among
themselves. They count toward the top-bar offer count the strip already mirrors. The strip's existing
open-the-top-card rule opens the top shortfall card when there is one.

**W9 — One-click add is the existing `addItem`.** Item number plus quantity, never a price (law 1).
The quantity is the arm's remaining need (`need − have`, minimum 1). A refused add surfaces the
envelope's own message through the console's existing refusal path. Nothing is optimistic: the card
re-reads the next `SessionState`.

**W10 — No money in the region.** Arm discounts are words from the existing discount-definition rule.
The existing "nothing formatted as money" guarantee is extended to cover every new phrase.

**W11 — Degradation (§9).** Absent `getShortfall` ⇒ today's classification exactly. Absent `rewards`
on a shortfall ⇒ the card states *qualified, waiting for a reward product* with no arm rows and no
add. Absent `rewardLink` ⇒ no link header. An unknown `kind` on an arm ⇒ the row names nothing it
cannot say and offers no add.

**W12 — Store changes.** A rebind re-projects the near-misses at the new plant. Any open arm
resolution is keyed by transaction, offer, arm **and plant**, so it re-resolves rather than showing the
old store's stock.

**W13 — Modules.** All within `features/callcenter/console/`: the guidance view model (new class,
precedence, arm rows, link header, coupon-spent phrase), the strip component (new card variant), the
feature `api.ts` (`resolveReward`), and the qualifying-item mapping reused for reward rows. Wire types
extend the call-center models in `core/models`. No new feature, route, store or namespace.

**W14 — i18n.** New keys in the existing `callcenter` namespace for: the shortfall headline/statement,
the two link headers, the arm met mark, the "any 1 of N" grouping subject (reuse the existing set
phrase where it fits), the coupon-spent statement with a `{{codes}}` param and plural form, the
"no stock at this store" arm state, and the degraded *waiting for a reward product* statement. No
literal strings (`i18n-zero-literal`), logical utilities only (`logical-tailwind`).

## Testing Decisions

- **A good test pins what the agent is told, from a given projection.** Feed near-misses in, assert the
  class, the order, the phrases (as keys plus params) and which controls exist. Never assert markup
  structure or private helpers.
- **One primary seam: the guidance view model, pure, in vitest** (tier: pure in-memory). It already has
  a test file with the three-class fixture and the no-money guard. New cases:
  - a shortfall is class *shortfall* whatever `isReady` says;
  - a skipped offer still wins over a shortfall;
  - a coupon-gated shortfall never yields `needsCoupon`, and an unmet coupon still does;
  - a true out-ranked offer still yields `counted`;
  - arms come out one row per arm in `armId` order, each with its own discount phrase, a met mark
    when `have ≥ need`, and no add on a met arm;
  - the link header is *any* under OR and *each* under AND, and absent when the wire omits it;
  - the coupon-spent phrase carries the codes;
  - shortfall cards rank above actionable ones and count toward the total;
  - every W11 degradation;
  - the no-money guard holds over arm discounts.
- **The reward resolution reuses the qualifying-item mapping**, so its existing tests cover the rows.
  Add one case for the empty-after-stock-filter arm state.
- **A fixture taken from the staging evidence.** Bonus buy `803`, coupon `SS222` → `COUP01`, arms
  `500061` (20%) OR `500062` (10.00 off), basket `208730`. It starts provisional and becomes a capture
  when BO-1/BO-2 ship, the same path fixtures 01–15 took.
- **Flow tier: extend the existing stubbed guidance drive** (`tools/callcenter-guidance-drive.mjs`,
  prior art also `tools/guidance-138-drive.mjs`). The leg: apply the coupon → shortfall card on top
  with the spent line → expand the `500062` arm → one-click add → the card is gone and the fired
  promotion carries the engine's money. Envelopes are stubbed to the W2/W5 shapes until a live SIS.Api
  carries them.
- **No RTL.** Spec 083's ruling stands: the component is a thin renderer over the view model. This
  spec does not bootstrap RTL. Gates: `typecheck`, `lint`, `vitest`, the drive.

## Out of Scope

- **Refusing a coupon before it is burned** when no reward product is in the basket (rejected in the
  grilling: it forces products-first ordering and needs a validate-without-redeem step).
- **A submit-time warning** that an order still holds a spent coupon that gives nothing. A sound
  follow-up, but it is a new confirmation kind on the contract and was kept out of this slice.
- **The buy-side discovery gap** (787-C / BackOffice 855, `NOT_DISCOVERED`): a basket holding only a
  promotion's buy-side item never loads the promotion at all. That is a different state (the offer
  was never evaluated) and the existing *get side not yet covered* acknowledgement stays as it is.
- **The WPF Check-Offer screen** beyond the READY predicate fix it inherits from BO-1. A shortfall
  chip there is BackOffice's to decide.
- **The two loyalty defects** found in the same investigation (Further Notes). They are real but are
  a separate fix.

## Further Notes

**BackOffice asks — not filed.** The web half is blocked on BO-1 and BO-2 for live verification only.
It builds and drives against stubs.

- **BO-1 — the shortfall on the near-miss.** In the engine's available-offers projection, a get-side
  shortfall (`ConditionShort`, analysis code 063) is no longer *ready*. The call-center projection
  emits W2's `getShortfall`, `rewardLink`, `rewards[]` (one per get-side condition, with per-arm
  `have`/`need` and discount definition) and `couponsSpent` (matched off the session's coupon ledger).
  Contract amendment v1.12 in §10, with the "why not 2.0" reasoning of W3.
- **BO-2 — `CallCenterWeb/ResolveReward`.** W5, reusing the prerequisite resolver's core (grouping
  expansion, plant stock filter, rank, cap) over a get-side condition's materials.
- **BO-3 — the till/web parity check.** The engine and the near-miss projection also ship to tills
  (SIS.Pos pack), so BO-1's READY change must be released through the pack schedule, and the WPF
  Check-Offer READY chip re-checked.

**Found in the same investigation, separate asks — not filed:**

- **Loyalty tier never reaches the engine in the call center.** `attachCustomer` calls the engine's
  loyalty attach with the member id and mobile only, with no tier and no groups. NewPos passes the
  tier. The server engine has no loyalty service to fill it in, so every tier- or group-restricted
  bonus buy is skipped by the validator on every call-center order.
- **The engine header's `LoyaltyId` is empty on a session that says loyalty is attached** (staging
  `06GFECB9F1MGCPEWTB1SGBNWC2`: `LoyaltyAttached=1`, customer `1000000034`, header `LoyaltyId` blank).
  Cause not yet found.
- **Local environment, not code:** local dev SIS.Api points at `POS_Server`, which does not carry
  bonus buy `803`. A local reproduction needs that bonus buy (header, prerequisite, condition and
  `BbyCond201` rows) and its coupon template copied in, or SIS.Api pointed at `POS`.

**Ops Console spec 380** re-shells the call-center console (tickets 407–409). The shortfall card lives
inside the guidance strip and inherits whatever shell it sits in. If both waves run together, the
strip's file is the likely merge point.
