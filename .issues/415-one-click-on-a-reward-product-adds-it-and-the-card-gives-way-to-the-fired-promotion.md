---
status: open
spec: 412
blocked-by: 414
---

# 415 — One click on a reward product adds it, and the card gives way to the fired promotion

**Slice 2 of [spec 412](412-a-qualified-promotion-names-the-reward-it-is-waiting-for-spec.md).** It
closes the loop the grilling asked for: the agent goes from *qualified, waiting* to the caller's
discount without leaving the card.

## What to build

Expanding a reward arm lists the products that would satisfy it, stock-checked **at the order's
store**. Each has the same one-click add the prerequisite card already offers. When the add fires the
offer, the shortfall card disappears and the fired promotion carries the engine's money. Spec
decisions **W5**, **W6** (resolution + add), **W9**, **W12** and **W14** (this slice's keys).

- **Contract**: add `GET CallCenterWeb/ResolveReward?transactionId=&offerId=&armId=` as a new §3
  subsection beside `resolvePrereq`, under the same v1.12 amendment 413 opened:
  - result `{ offerId, armId, reward, items, truncated, topN }`, where `items` are the existing
    qualifying-item rows;
  - the same rules as `resolvePrereq`: on demand only; stock-filtered at the plant, ranked, capped at
    the server's `topN`; `atp: null` on a degraded stock read; the call-center door only; the same
    refusal codes when the offer is no longer a shortfall;
  - **no new error code.**
- **api**: `resolveReward` in the feature's call-center api, through `@/core/api`.
- **Resolution on demand.** Expanding an arm queries `ResolveReward` and is never prefetched. The query
  is keyed by transaction, offer, arm **and plant**, so a store change re-resolves (W12). Rows reuse
  the existing qualifying-item mapping, unchanged. An arm whose list comes back empty after the stock
  filter says *not available at this store*. A truncated list says so, like the prerequisite list.
- **One-click add (W9)**: the existing `addItem` path with item number and quantity `need − have`
  (minimum 1), never a price. A refused add shows the envelope's own words through the strip's existing
  outcome path. Nothing is optimistic: the next `SessionState` decides whether the card stays.
- **AND arms**: the card stays until the engine fires the offer. A satisfied arm shows met and offers
  no add (414's mark), so the agent is led to the missing arm.

## Spine reach

contract doc · model (`ResolveReward` result type) · api (`resolveReward`) · component (arm expansion,
rows, add) · i18n (`callcenter`) · test (vitest + guidance drive)

## Proof (→ `tdd` red-green cycles)

- [ ] `aRewardResolutionMapsToTheQualifyingRows` — a `ResolveReward` payload maps through the existing
  row mapping, `truncated` is stated, and an empty-after-filter arm yields the *not available at this
  store* state · pure
- [ ] `theAddAsksForWhatTheArmStillNeeds` — the add for an arm at `have 0 / need 1` asks for 1, at
  `have 1 / need 3` asks for 2, and a met arm offers no add · pure
- [ ] Guidance drive leg, end to end on stubs: coupon applied → shortfall card on top → expand
  `500062` → one-click add → the next state has no shortfall card and a fired promotion for
  `000100000803` with the engine's discount; plus a refused add showing the server's message · flow
  (Playwright drive)

## Boundaries

**New endpoint** `CallCenterWeb/ResolveReward`. The server half is BackOffice ask **BO-2 (unfiled)**,
so the drive stubs it to the W5 shape, and live verification waits on BO-1 and BO-2. It handles the
same `success:false` codes `ResolvePrereq` does, and adds none. New keys in the existing `callcenter`
namespace. No RTL.

## Done when

The vitest cases are green, `typecheck` and `lint` pass, and the drive goes from shortfall card to fired
promotion with one click on the staging fixture.

## Blocked by

[414](414-the-shortfall-card-names-each-reward-arm-the-link-and-the-spent-coupon.md)

## Open questions

- Once BO-1 and BO-2 exist, the owner smoke on staging (re-apply a fresh coupon on a session at a plant
  that stocks `500062`) turns the provisional fixture into a capture. Who runs it, and against which
  staging session, is the owner's call. It is not a gate on this ticket.
