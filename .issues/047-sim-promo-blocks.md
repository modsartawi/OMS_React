---
status: open
spec: 043
blocked-by: 045
---

# 047 — firedPromotionsRenderAsBuyGetBlocks

## What to build

The fired promotions render as **plain-language buy → get blocks** — the heart of the rework —
replacing the result-level Applied Bonus Buys tab. Driven by `promoView(result).blocks`, each block:

- a **plain-language title** ("Buy 1, Get 1 Free", "Second one, half price") composed from `t()`
  templates keyed on kind + quantities — not free text; the server `description` passes through as data;
- a **Buy box → Get box** relationship: the trigger line(s) on the left, the reward line(s) on the
  right, the get box carrying the discount kind and the reward amount (a free reward shows **FREE**, a
  discounted reward shows the new price with the original struck through);
- a **cross-product** reward tagged "reward"; a **grouping** prerequisite read as "Any 2 items from
  '<category>'";
- a **header identity line** carrying the BBY key, promo number, offer id, remaining usage and total
  saved — so nothing the old Applied tab showed is lost;
- **bidirectional cross-highlight**: hover/focus a block and its grid lines light up; hover a grid line
  and its block lights up — keyed on `conditionKey`.

Renders on the degradation path too (undivided block, no partner precision); the exact buy→get split
and precise cross-highlight sharpen once the projection (044) lands — no code change here.

## Spine reach

component (promo-blocks pane + grid↔block highlight wiring) · i18n (`simulation` keys) · test (app-drive)

## Proof (→ `tdd` red-green cycles)

- [ ] a fired promotion renders a block with its buy→get boxes + identity fields (key/promo/offer/usage/saved) · component (RTL, when runner lands)
- [ ] a free reward shows "FREE"; a discounted reward shows new price + struck original · component (RTL, when runner lands)
- [ ] hovering a grid line marks its block hot and vice-versa · component (RTL, when runner lands)

Runner not installed — verify via `npm run typecheck` + drive `npm run dev`: run the sketch's basket
against live `SIS.Api`, confirm each promotion reads as a buy→get block and the cross-highlight works
both ways.

## Boundaries

Removes the **Applied Bonus Buys tab** (folded into blocks). New `simulation` i18n keys (block titles,
reward tags, identity labels). No endpoint change.

## Done when

Fired promotions render as buy→get blocks carrying every old Applied-tab field, with bidirectional
grid↔block cross-highlight, verified in the running app; typecheck green.

## Blocked by

[045](045-sim-promoview-model.md) — blocks read `promoView(result).blocks`.
