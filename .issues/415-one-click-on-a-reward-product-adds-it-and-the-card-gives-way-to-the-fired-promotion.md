---
status: done
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

- [x] `aRewardResolutionMapsToTheQualifyingRows` — a `ResolveReward` payload maps through the existing
  row mapping, `truncated` is stated, and an empty-after-filter arm yields the *not available at this
  store* state · pure
- [x] `theAddAsksForWhatTheArmStillNeeds` — the add for an arm at `have 0 / need 1` asks for 1, at
  `have 1 / need 3` asks for 2, and a met arm offers no add · pure
- [x] Guidance drive leg, end to end on stubs: coupon applied → shortfall card on top → expand
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

## Comments

**Done 2026-10-03.** Gates: `typecheck` · `lint` (3/3) · `npm test` 3199/3199 · `build` green. Both
Proof describes were run red first (14 failures) against 414's view model:
`aRewardResolutionMapsToTheQualifyingRows` in the new `prereq-view.test.ts`, and
`theAddAsksForWhatTheArmStillNeeds` in `guidance-view.test.ts`. The guidance drive is **154/155**. All
30 new checks pass. The one failure is the **pre-existing** stale `captured` assertion that 413 and 414
recorded. `/code-review`: no findings. `/standards-review`: no hard violations, no blocking spec
defects. The cheap findings were applied (see below).

**As built:**

- **Contract.** The §1.1 verb row, a new **§3.7** `resolveReward` (W5's shape and rules, with no new
  code), §3.3 pointing to its get-side twin, the header note, and 413's **one** v1.12 §10 row extended
  with the new read (not a second row).
- **Model and api.** `RewardResolution` in `core/models/callcenter`. `callCenterApi.resolveReward`.
  `rewardKey(transactionId, offerId, armId, plant)` carries the plant (W12), and like `prereqKey` it is
  not keyed by version.
- **View model.**
  - `RewardArm.addQty` is `max(1, need − have)`.
  - It is `null` on a met arm or an unknown kind (W11). `null` means no add and nothing to resolve.
  - It joins the money guard's allow-list as a unit count.
- **`prereq-view.ts`.**
  - `prereqRows` now accepts any `{ items }`, so reward rows go through the **same** mapping, unchanged.
  - `rewardResolutionView` adds two statements: `empty` (*Not available at this store.*, only once an
    answer has arrived) and `truncated` (*The top N at this store — there are more.*).
- **Strip.**
  - On the **open** shortfall card, each arm that can still take an add gets a *Show products* toggle,
    one arm open at a time.
  - `RewardProducts` asks `ResolveReward` only when its arm is opened, never prefetched, with
    `staleTime: Infinity`.
  - Its rows are `QualifyingRow`, now carrying the arm's `qty`. `GuidanceAdd.qty?` flows to the page's
    one `addItem` as `from.qty ?? 1`.
  - A blank `offerId` (859) leaves the arms as plain statements.
- **Fixture.** `unreachable-v1_0.json` → `rewardResolution` holds the provisional W5 answer for arm 2
  (`500062`), exported as `REWARD_RESOLUTION`. It becomes a capture when BO-2 ships.
- **Drive.** New legs, all on stubs:
  - expand 500062 → one ask, for that arm only → one click sends `{ itemNumber: 500062, qty: 1 }` and no
    price → the card is gone, the strip says *fired*, and the 500062 line carries 803's engine
    `10.00`;
  - a refused add (`ITEM_NOT_SELLABLE`) shows the envelope's own words, and the card stays;
  - AND with a met arm, then AND **driven**: the add satisfies arm 2, the card stays, arm 2 reads met,
    arm 1 leads, and the banner says *has not fired*;
  - an arm the stock filter emptied says *not available at this store*.

🚩 **Rulings for the owner:**

1. **A refused add surfaces on the console's shared refusal path**, the item search panel's
   `data-cc-search-add-error`. That is where a refused prerequisite add (172) already lands. Spec W9
   (*"the console's existing refusal path"*) is met. The ticket's *"the strip's existing outcome path"*
   cannot be met as written, because the strip's `Outcome` has only fired / firedOther / didNotFire.
   The cost: the message appears above the basket, away from the card at the bottom. Moving it would
   change 172's behaviour too, so it is left for the owner.
2. **A truncated reward list is a statement, not the prerequisite list's *Search the other N*
   hand-off.** The item search's offer narrowing is the **buy** side, so it would list what already
   qualified, not the reward. The figure is the rows drawn, not `topN`.
3. **Arm expansion is offered on the open card only, one arm at a time.** This keeps the 18rem clamp,
   and W8 opens the top shortfall card by default.
4. **The drive leg starts from the post-coupon state** (`header.coupons: SS222`, amount 0) rather than
   driving the coupon chip. A stubbed apply would only swap one stubbed state for another.
5. **After an AND add that fires nothing, the banner says *Added — this offer has not fired.*** That is
   true but generic: the buy side is complete, so there is no "needs N more". A shortfall-specific
   phrase (*still waiting for a reward product*) would be a small `classifyAdd` addition if wanted.

**Declined review findings:**

- **Bundling `GuidanceCard`'s shortfall-only fields** (Data Clumps, deferred from 414). This slice did
  not grow the clump, since `addQty` lives on `RewardArm`. Bundling would rewrite most of 413/414's
  assertions in a closing slice. Worth a standalone refactor now that the card's shape is final.
- **Threading `transactionId` / `plant` / `actions`**, and RewardProducts mirroring `Qualifying`'s
  loading and error lines. The two lists differ in the hand-off and the unaddressable state, and
  extracting a shared hook for two callers was judged not worth it here.
- **Renaming `prereqRows` / `PrereqItem` to side-neutral names.** That would churn 172's call sites and
  the contract's §3.3 vocabulary.
- **Remaining "offer" prose** in the strip. It matches the file's own idiom throughout. The one new
  model comment was changed to *bonus buy's get side*.
