---
status: done
spec: 412
blocked-by: 413
---

# 414 — The shortfall card names each reward arm with its own discount, the get-side link, and the spent coupon

**Slice 1 of [spec 412](412-a-qualified-promotion-names-the-reward-it-is-waiting-for-spec.md).** It
thickens 413's card from *qualified, waiting* into *which products, at what discount, how many, and
what it has already cost*.

## What to build

The shortfall card tells the agent what the reward is waiting for. Spec decisions **W2** (now drawn),
**W6** (rows, without resolution), **W7**, **W10**, **W11** and **W14** (this slice's keys).

- **One row per reward arm**, in `armId` order:
  - the subject: a material by its number, or a grouping as *any 1 of N* using the existing set
    phrase where it fits;
  - that arm's own discount phrase, through the existing discount-definition rule;
  - a **met** mark when `have ≥ need`. A met arm never offers an add (415 adds the add).
- **The link header**: *Add any one* under `rewardLink: 'any'`, *Add one of each* under `'each'`, no
  header when the wire omits it.
- **The coupon-spent line (W7)**: when `couponsSpent` is non-empty, one statement naming the code(s),
  plural-aware. It says the coupon is spent on this order and gives nothing until a reward product is
  added. It is a statement with no control. Removing the coupon stays at the coupon chip.
- **No money (W10)**: every new phrase passes the strip's existing *nothing formatted as money* guard,
  including a Fixed Discount arm (`10.00 off` stays a definition phrase, never a money-shaped figure).
- **Degradation (W11)**: absent `rewards` ⇒ 413's statement only. An arm of unknown `kind` names
  nothing it cannot say. Absent `couponsSpent` ⇒ no line.

## Spine reach

logic (guidance view model: arm rows, link header, coupon-spent phrase) · component (shortfall card
rows) · i18n (`callcenter`) · test (vitest + guidance drive)

## Proof (→ `tdd` red-green cycles)

- [x] `eachRewardArmIsItsOwnRowWithItsOwnDiscount` — the staging fixture yields two rows in `armId`
  order, 20% on `500061` and a fixed-discount phrase on `500062`; a grouping arm reads *any 1 of N*;
  `have ≥ need` marks an arm met · pure
- [x] `theLinkAndTheSpentCouponAreStated` — *any* under OR, *each* under AND, none when absent;
  the coupon-spent phrase carries `SS222`, pluralises for two codes, and is absent without
  `couponsSpent` · pure
- [x] `noFigureInTheRegionIsFormattedAsMoney` extended over the arm phrases (the existing guard, new
  inputs) · pure
- [x] Guidance drive leg: the card shows both arms with their discounts, *Add any one*, and the
  *SS222 is spent* line · flow (Playwright drive)

## Boundaries

No new endpoint (still stubbed to BO-1, unfiled). New keys in the existing `callcenter` namespace.
Logical utilities only. No RTL.

## Done when

The vitest cases are green, `typecheck` and `lint` pass, and the drive shows both reward arms, the
link header and the spent-coupon line on the staging fixture.

## Blocked by

[413](413-a-get-side-shortfall-reads-as-qualified-and-waiting-above-every-other-card.md)

## Comments

**Done 2026-10-03.** Gates: `typecheck` · `lint` (3/3) · `npm test` 3185/3185 · `build` green. The two
new describes and the extended money guard live in `guidance-view.test.ts`, and were run red first
(20 failures) against 413's view model. The guidance drive is **124/125**: all 7 new 414 checks pass
(both arms, in armId order, `20% off` / `10 off`, *Add any one*, the *SS222 is already spent* line with
no control on it, no add yet). The one failure is the **pre-existing** stale `captured` assertion that
413 recorded. `/code-review`: no findings. `/standards-review`: no hard violations, no blocking spec
defects. The cheap findings were applied (see below).

**As built:**

- `GuidanceCard` gains three fields, all empty or null on every class but `shortfall`:
  - `arms: RewardArm[]`, where a `RewardArm` is `{ armId, subject, discount, met }`;
  - `rewardLink` (the header phrase);
  - `spentCoupons` (the W7 phrase, with `{{codes}}` joined `, ` and `count` for the plural).
- Arms are sorted by `armId`: numerically when both ids are numerals, as text otherwise.
- Subjects:
  - a material arm reads `Item 500061`, or `2 of item …` when `need` is above 1;
  - a grouping arm reuses the prerequisite set phrase (`guidance.set` / `setCounted`) through a new
    shared `setPhrase`;
  - an unknown kind, or a material arm with no material, reads *A reward product* and still shows its
    discount.
- `met` is `have ≥ need`, and only when `need > 0`.
- The rename and the extraction deferred from 413 are both done. The numeric `GuidanceCard.shortfall`
  is now **`stillNeeded`** (also in `ItemPanel`'s price-check offers). `ShortfallCard` and `Card` now
  share a `CardShell`.
- New keys under `callcenter:guidance.shortfall.*`: `linkAny`, `linkEach`, `armItem_one/_other`,
  `armUnknown`, `armMet`, `couponSpent_one/_other`.
- The W10 example: the 161 rule words staging's `R 10` arm as **`10 off`**, not `10.00 off`. That is
  correct, and both the test and the drive assert it. Don't "fix" it toward the ticket's example.

🚩 **Rulings for the owner:**

1. **The spent-coupon line still shows when `rewards` is absent.** That departs from this ticket's
   literal *"absent `rewards` ⇒ 413's statement only"*. W7 is unconditional and W11 asks only for no rows
   and no add. The coupon is the caller's loss either way (US11). Pinned by a test.
2. **The link header is suppressed when there are no rows.** A link between arms the card cannot show
   says nothing.
3. **Arm rows are drawn on closed cards too.** They are statements, like the actionable card's set
   statement. Resolving an arm stays on demand, in 415.
4. **The grouping arm's wording** is the existing set phrase, *any 1 from this selection · 42 qualify*.
   "Qualify" is buy-side wording, so this is a wording call.

**Declined review findings:**

- Grouping the four shortfall-only fields into one `reward: {…} | null` (Data Clumps). 415 adds the
  per-arm add and resolution, so the card's shape is still moving. Revisit it then.
- `Intl.ListFormat` for the codes separator. It matches `coupon-view.ts`'s own in-TS `join`. Pick it up
  with the RTL retrofit, across both.

