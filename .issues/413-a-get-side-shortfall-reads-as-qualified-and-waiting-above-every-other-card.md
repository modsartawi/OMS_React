---
status: done
spec: 412
blocked-by: —
---

# 413 — A get-side shortfall reads as qualified-and-waiting, above every other guidance card

**Slice 0 of [spec 412](412-a-qualified-promotion-names-the-reward-it-is-waiting-for-spec.md).** It
proves the new wire shape end to end (contract → model → view model → strip → words). It also retires
the riskiest part: re-ordering a classification that four existing card classes depend on, without
breaking any of them.

## What to build

When the server reports a near-miss as a **get-side shortfall**, the guidance strip draws a new
**shortfall card**:

- It says the offer **qualified** and is waiting for a reward product.
- It is ranked above every other card, opened by default, and counted in the strip's and top bar's
  offer count.
- It never says *already counted* and never says *needs a coupon*.

Spec decisions **W2** (the shortfall flag only; `rewards`, `rewardLink` and `couponsSpent` are typed
here but drawn by 414), **W3**, **W4**, **W8**, **W11** (the absent-`rewards` statement) and **W14**
(this slice's keys).

- **Contract first.** Add the v1.12 amendment to the call-center contract: the four optional near-miss
  fields from spec 412 W2, the W3 "`isReady` is false for a shortfall" rule, the §10 amendment row, and
  the "why 1.12 and not 2.0" paragraph (a v1.11 console draws a shortfall as an ordinary actionable
  card, which is the safe direction). `ResolveReward` is **415's** to add, not this slice's.
- **Wire types.** Extend the near-miss model with the optional W2 fields, exactly as spec 412 shows
  them, every one optional.
- **Classification precedence (W4).**
  1. `skipReason` present ⇒ unavailable.
  2. `getShortfall` ⇒ **shortfall**.
  3. Driving prerequisite is a coupon *that is still unmet* ⇒ needsCoupon. A coupon prerequisite counts
     as met when the offer's progress is complete, because the driving prerequisite is the first unmet
     one whenever any is unmet.
  4. `isReady` ⇒ counted.
  5. Otherwise ⇒ actionable.
- **Ranking and counts (W8).** Shortfall cards come before actionable ones, in server order among
  themselves. The top-bar count covers actionable plus shortfall cards, and the card that opens by
  default is the top shortfall card when there is one.
- **The card (this slice's part of W6).** Headline from the discount definition or the server
  description, plus the *qualified, waiting for a reward product* statement. No arm rows and no add
  yet: that is exactly the W11 degraded rendering, so this slice already ships a truthful card.
- **Fixture.** Add a provisional near-miss fragment from the staging evidence:
  - bonus buy `000100000803`, `getShortfall: true`, `isReady: false`, no `skipReason`;
  - `rewardLink: 'any'`, two arms (`500061` at 20%, `500062` at 10.00 off, each `have 0 / need 1`);
  - `couponsSpent: ['SS222']`, driving prerequisite the `COUP01` voucher, met.

  Mark it provisional (BO-1 unbuilt), the way fixtures 01–08 started.
- **The price check is untouched.** It reuses the view model, and its wire never carries
  `getShortfall`, so its cards must come out byte-identical.

## Spine reach

contract doc · model (`core/models` call-center types) · logic (guidance view model) · component
(guidance strip, new card variant) · i18n (`callcenter`) · test (vitest + guidance drive)

## Proof (→ `tdd` red-green cycles)

- [x] `aShortfallIsDrawnAsQualifiedWhateverItsReadyFlagSays` — the staging fixture classes as
  *shortfall*, never *counted* or *needsCoupon*, and carries the qualified statement · pure
- [x] `theOtherClassesKeepTheirWords` — skipped beats shortfall; an unmet coupon is still
  *needsCoupon*; a met coupon on a non-shortfall falls through to *counted*; an out-ranked offer is
  still *counted*; a v1.11 projection (no new fields) classifies exactly as before, and the price
  check's cards are unchanged · pure
- [x] `shortfallCardsRankFirstAndCount` — shortfall before actionable, counted in the top-bar count,
  opened by default · pure
- [x] Guidance drive leg (stubbed to the fixture): the strip shows the shortfall card on top, with the
  qualified statement and no "needs a coupon" text · flow (Playwright drive)

## Boundaries

No new endpoint. Wire fields are stubbed: the server half is BackOffice ask **BO-1 (unfiled)**, so
live verification waits on it. New keys in the existing `callcenter` namespace only. No new route,
store or nav. Runner already bootstrapped (vitest). No RTL.

## Done when

The three vitest cases are green, `typecheck` and `lint` pass, and the guidance drive shows the
shortfall card on top for the staging fixture.

## Blocked by

None — can start immediately.

## Comments

**Done 2026-10-03.** Gates: `typecheck` · `lint` (3/3) · `npm test` 3167/3167 · `build` green.
The three vitest describes live in `guidance-view.test.ts`. They were run red against HEAD's
`guidance-view.ts` (16 failures) and green against the new module. The guidance drive is
**117/118**: the 11 checks of the new `shortfall` leg all pass. The one failure is **pre-existing**
(HEAD scores 106/107 with the same failure). The `captured` scenario still expects its two blank-id
offers as *cards*, but since the v1.10 re-capture both are `needsCoupon`, which the strip draws as a
list. It is a stale assertion, left alone here.

**As built:**

- `GuidanceClass` gains `shortfall`. `GuidanceView` gains `shortfall[]` and `withinReach[]` (shortfall
  cards then actionable ones, the single statement of W8's rank), and `actionableCount` becomes
  `withinReachCount`. `openByDefault` is `withinReach[0]`. Cards carry a `qualified` phrase (null on
  every other class).
- The new keys are `callcenter:guidance.shortfall.mark` and `.waiting`. The card has no meter, no
  *add N more* and no prerequisite resolve. It uses the attention ("waiting") tone, because a green
  tick read as *applied* (spec review).
- The fixture is `getShortfall` in `__fixtures__/unreachable-v1_0.json` (`GET_SHORTFALL` in
  `payloads.ts`), so the tests and the drive read one file.
- The contract has a new §3.6, a 1.12 row and the "why 1.12 and not 2.0" paragraph. That row also
  notes that 1.11 (194 / BackOffice 880) never got a row of its own.

🚩 **Rulings for the owner:**

1. **A met coupon is never actionable, and that departs from W4's literal precedence.** Literally,
   a met coupon with no shortfall flag and `isReady: false` falls through to *actionable*. That card
   would open by default and offer a one-click add of the **campaign voucher** (159's hazard,
   flagged by `/code-review`). It is now *counted* whatever `isReady` says. Consequence: against a
   **v1.11** server, staging's 803 itself (`isReady: true`, coupon 1/1, no flag) changes from
   *needs a coupon* to *already counted*, which is still false. Only BO-1 removes that sentence.
   §3.6's degradation bullet now names this exception instead of claiming "today's classification
   exactly".
2. **The palette lists no shortfall cards.** An offer row narrows the item search to the offer's
   *prerequisite*, which a shortfall has already met (for a coupon-gated one, the voucher). So the
   top bar counts N while the palette shows only the actionable rows. US25's keyboard path to the
   reward add belongs with 415.
3. **`NearMissReward.kind` is widened with `(string & {})`** beyond the spec's
   `'material' | 'grouping'`. This is type-only, so W11's unknown-kind degradation can be written
   against it.

**Deferred to 414 (standards review):**

- `GuidanceCard.shortfall` (the numeric buy-side delta) collides in name with the new `shortfall`
  class. Rename the numeric field (e.g. `stillNeeded`) when 414 reshapes the card.
- `ShortfallCard` duplicates `Card`'s shell (wrapper, toggle, definition, description). Extract a
  shared shell once 414 settles the body.
