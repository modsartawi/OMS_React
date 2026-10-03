---
status: open
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

- [ ] `eachRewardArmIsItsOwnRowWithItsOwnDiscount` — the staging fixture yields two rows in `armId`
  order, 20% on `500061` and a fixed-discount phrase on `500062`; a grouping arm reads *any 1 of N*;
  `have ≥ need` marks an arm met · pure
- [ ] `theLinkAndTheSpentCouponAreStated` — *any* under OR, *each* under AND, none when absent;
  the coupon-spent phrase carries `SS222`, pluralises for two codes, and is absent without
  `couponsSpent` · pure
- [ ] `noFigureInTheRegionIsFormattedAsMoney` extended over the arm phrases (the existing guard, new
  inputs) · pure
- [ ] Guidance drive leg: the card shows both arms with their discounts, *Add any one*, and the
  *SS222 is spent* line · flow (Playwright drive)

## Boundaries

No new endpoint (still stubbed to BO-1, unfiled). New keys in the existing `callcenter` namespace.
Logical utilities only. No RTL.

## Done when

The vitest cases are green, `typecheck` and `lint` pass, and the drive shows both reward arms, the
link header and the spent-coupon line on the staging fixture.

## Blocked by

[413](413-a-get-side-shortfall-reads-as-qualified-and-waiting-above-every-other-card.md)
