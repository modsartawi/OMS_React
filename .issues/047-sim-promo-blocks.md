---
status: done
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

- [x] a fired promotion renders a block with its buy→get boxes + identity fields (key/promo/offer/usage/saved) · component (RTL, when runner lands)
- [x] a free reward shows "FREE"; a discounted reward shows new price + struck original · component (RTL, when runner lands)
- [x] hovering a grid line marks its block hot and vice-versa · component (RTL, when runner lands)

Runner not installed — verified via `npm run typecheck` + `npm run build` (both green) + a Playwright
drive of the real `SimPromoBlocks` against fabricated `promoView` blocks (a scratch Vite entry, since
the live SIS.Api's 044 projection is unlanded so every live block is degraded). 13 assertions passed:
buy→get boxes + identity fields, FREE + struck-original + reward tag, the degraded undivided-items box,
and the block↔grid cross-highlight both ways (grid-line hover lights the block ring, block hover raises
the shared hot state). Harness kept in the session scratchpad, not committed.

## Boundaries

Removes the **Applied Bonus Buys tab** (folded into blocks). New `simulation` i18n keys (block titles,
reward tags, identity labels). No endpoint change.

## Done when

Fired promotions render as buy→get blocks carrying every old Applied-tab field, with bidirectional
grid↔block cross-highlight, verified in the running app; typecheck green.

## Blocked by

[045](045-sim-promoview-model.md) — blocks read `promoView(result).blocks`.

## Comments

- **Grouping prerequisite note deferred (data gap).** The buy box renders the concrete resolved buy
  lines, not the "Any 2 items from '<category>'" abstraction the What-to-build lists. The applied model
  (`AppliedBonusBuy`) carries no `matGrouping`, and the 044 projection contract adds only
  `isPrerequisite`/`isCondition`/`conditionKey`/`bbyItemIndex` — no grouping/category. Surfacing the
  category would need a model + projection field beyond this ticket's "no endpoint change" boundary, so
  it's left as a follow-up rather than fabricated. Concrete buy lines are correct and legible today.
- **Cross-highlight keys on `conditionKey` with a `bbyNumber` fallback.** A grid-line hover raises
  `{ bby, conditionKey }`; the row-class rule lights only lines sharing both. On the degradation path
  `conditionKey` is null → the whole bby lights, and the precision sharpens automatically when 044 lands
  (no code change, per the ticket). A block hover raises the whole bby (a block spans all its apps).
- **Block titles are keyed on kind + buy/get item *counts*** (not summed line quantities), so a same-SKU
  1+1 reads "Buy 1, Get 1 Free" rather than "Buy 2, Get 2". The specific "second one, half price"
  phrasing isn't derivable without the percent value, so percent falls back to a generic template; the
  server `description` rides through as a secondary line so the real offer name is never lost.
