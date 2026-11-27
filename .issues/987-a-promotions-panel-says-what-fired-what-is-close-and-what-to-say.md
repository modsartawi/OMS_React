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

- [x] `appliedCardsNameTheirLinesByNumber`: lineIds map to D4 numbers, and an unknown lineId is dropped rather than shown as 0 · pure
- [x] `nearMissesKeepTheirShortfallOrder`: 412's ordering survives the move · pure
- [x] `noFigureIsComputedHere`: every amount on a card is a server field (a property test over fixtures) · pure
- [x] Guidance drive retargeted: coupon → shortfall card in the panel → one-click add → it moves to Applied · flow

## Boundaries

No wire change. *Could still use* reads only what `CouponPicker` already fetches; if that is nothing for this caller, the column is absent and no new read is invented.

## Done when

On a live NOV10 + skincare walk the panel shows the fired coupon with its skipped medicine line, the bonus buy one step away, and the add completes it.

## Comments

**2026-11-27: built on branch `t/987`. The live NOV10 walk is still owed.**

Built:
- `promotions-panel.ts` (pure), `promotionsPanel(state)`:
  - `applied`: one card per `FiredPromotion`. It carries the server's description and `amount` verbatim, and `lines` are the D4 numbers from `lineNumbers(state)`, ascending and de-duplicated. A lineId the basket does not hold is dropped. The card id is positional when `offerId` is blank (859).
  - `coupon` / `notOn`: a fired promotion is a coupon's when an applied coupon's non-blank `description` equals the promotion's description exactly. Only then does the card list the basket lines it is **not** on. An automatic promotion never says "not on".
  - `oneStepAway` is `guidanceView(...).withinReach`, untouched, so 412's ranking (shortfall above actionable, server order within each) and its wording come along by construction.
  - `say`: the sentence that recommends each one-step card (`promotions.say.add` with the still-needed count, and `promotions.say.reward` for a shortfall).
- `PromotionsPanel.tsx` takes the strip's place under the basket. From 768px of order column up (a container query) it shows **Applied** and **One step away** side by side, and below that it stacks them. Each Applied card shows:
  - the description and the amount;
  - "Coupon NOV10" · "Lines 1 and 2" · "Not on line 3";
  - a *Say* sentence.
- `GuidanceStrip` is now the *One step away* column, and its cards, verbs, outcome banner, counted / needs-coupon / unavailable lists and top-bar count are unchanged. It draws one card per row (the column is too narrow for 171's 2-up grid), and each within-reach card carries its *Say* line.
- `SayLine.tsx`: the offer goes into the sentence through a `<Trans>` `<offer>` slot as a `<bdi data-cc-server-text>`. Amounts and line lists are wrapped whole with `fsi`. Lists use `listText` (Intl.ListFormat), so "1, 3 and 4" reads correctly in Arabic too.
- i18n: `promotions.*` in en and ar. The Arabic keys carry all six plural forms.

Proof:
- `promotions-panel.test.ts` 13/13. `noFigureIsComputedHere` walks every money-named field in the view over 4 fixture states and requires each to be `Object.is` a `firedPromotions[].amount`.
- `tools/callcenter-guidance-drive.mjs` 166/166 (was 154/155 on the base). What it covers now:
  - The 415 scenario (SS222 spent, then the shortfall card, then a one-click add of 500062) now also checks that the shortfall card recommends itself, is not in Applied before the add, and afterwards moves to Applied as "Line 3" with "takes 10.00 SAR off line 3".
  - A new NOV10 scenario checks:
    - Applied shows "Lines 1 and 2", "Coupon NOV10" and "Not on line 3" for the medicine line.
    - The sentence carries the engine's 3.87.
    - Applied sits beside One step away at 1440.
    - The actionable card says "Add 1 more item…".
    - There is no Could still use column.
  - Retargeted: "the open card spans both columns" is now "one card per row: open and closed have the column's width". The empty-state height is measured on the column (`self-start`).
- **The base's failing check ("two offers sharing one blank offerId") was a stale drive, not a bug.** Both captured near-misses are `prereq.kind: "coupon"` and unmet, so since 159 they draw as needs-a-coupon rows, never as `[data-cc-card]`. The check now counts entries across every class and reads 2 of 2. The 859 property (two offers under one blank id stay two) holds.
- typecheck and lint are clean. `npm test` passes 12913/12913 after merging `spec/983-caller-console` (990/992 included). The guidance drive still passes 166/166 on the merge.
- Other drives that touch the region fail identically with and without this slice, so these failures were already on the base:
  - coupon-159: 99/103. The 4 failures are in the signup leg.
  - command-palette: 358/366. The failures are the last-row walk and the Jump rows.
  - bby-link: times out at its first page load on both.

Decisions for the owner:
- **Could still use is absent.** `CouponPicker` reads only `header.coupons`, which holds the coupons already applied. Nothing on the wire lists coupons a caller holds and has not used, so per the Boundaries no read was invented and no column is drawn. US10 needs a BackOffice read, for example the caller's unredeemed coupons on `CustomerHistory` or its own door. That ask is unfiled.
- **"Not on line N" depends on a description match**, because `FiredPromotion` carries no coupon attribution (contract §2.7). If the live walk shows that NOV10's promotion description differs from `header.coupons[].description`, the skipped line will not show. The clean fix is an additive `couponCode` (plus per-line skip facts) on `FiredPromotion`, which is a BackOffice ask and is unfiled.
- **No skip reason is shown.** No near-miss or fired-promotion field carries a per-line reason such as "medicine", so the card says "Not on line 3" without a why.
- The *Say* sentence shows the amount without its sign ("takes 3.87 SAR off"). The card's own figure shows the server's signed value (-3.87).

Owed:
- The live walk on the walk set-up (NOV10 + skincare): the coupon's skipped medicine line (it depends on the description match above), the bonus buy one step away, and the add completing it.
- The Arabic wording has not been reviewed by a native reader.
