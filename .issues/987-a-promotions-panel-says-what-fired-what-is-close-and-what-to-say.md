---
status: open
spec: 983
blocked-by: 985
---

# 987: A promotions panel says what fired, what is one step away, and what to say

Slice of [spec 983](983-the-console-is-built-around-the-caller-spec.md). Reference picture: the
*Call Center Console v3* artifact (v3).

## What to build

Below the basket, a panel with three columns (D7):
- **Applied**, one card per `FiredPromotion`:
  - the description and the amount;
  - "Lines 1, 3" from `lineIds` by D4's numbers;
  - when a coupon skipped lines, "Not on line 2" with the reason where the near-miss facts carry it;
  - a sentence to say.
- **One step away**, one card per `NearMiss` not ready:
  - a progress bar (`have/need`, or money toward a threshold);
  - the one-click adds from the existing `ResolvePrereq` / `ResolveReward` paths;
  - a sentence to recommend it.
  412's shortfall cards keep their order and wording.
- **Could still use**: the caller's held coupons that are not applied, each with *Apply*. The column
  hides when it is empty.

The guidance strip's cards move here and its verbs are unchanged.

## Spine reach

pure (`promotions-panel.ts`) · component (`PromotionsPanel`, retire the strip's card list) · i18n (sentences as keys with slots) · test

## Proof (→ `tdd` red-green cycles)

- [ ] `appliedCardsNameTheirLinesByNumber`: lineIds map to D4 numbers, and an unknown lineId is dropped rather than shown as 0 · pure
- [ ] `nearMissesKeepTheirShortfallOrder`: 412's ordering survives the move · pure
- [ ] `noFigureIsComputedHere`: every amount on a card is a server field (a property test over fixtures) · pure
- [ ] Guidance drive retargeted: coupon → shortfall card in the panel → one-click add → it moves to Applied · flow

## Boundaries

No wire change. *Could still use* reads only what `CouponPicker` already fetches; if that is nothing for this caller, the column is absent and no new read is invented.

## Done when

On a live NOV10 + skincare walk the panel shows the fired coupon with its skipped medicine line, the bonus buy one step away, and the add completes it.
