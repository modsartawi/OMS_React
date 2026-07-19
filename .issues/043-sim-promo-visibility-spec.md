---
type: spec
status: ready
---

# 043 — Simulation applied-promotion visibility rework (spec)

Synthesized from wayfinder map [039](039-sim-promo-visibility-rework.md) (destination reached): the
approved **B+C hybrid** sketch ([042-...PROTOTYPE.html](042-sim-promo-hybrid-lock.PROTOTYPE.html)), the
promo-shape [taxonomy](040-sim-promo-shape-taxonomy.TAXONOMY.md) (040), and the applied-BBY projection
decision. Speaks `CONTEXT.md` vocabulary (bonus buy / BBY, prerequisite, reward, discount type,
envelope, guardrail). Reworks the surface built by tickets 013–015 under
`src/features/pricing/simulation/`.

## Problem Statement

On the POS Simulation screen, a pricing analyst runs a basket and gets a flat per-line results grid
plus a right-hand **Applied Bonus Buys** tab that lists, one row per promotion, a summed discount and a
flat list of affected item numbers. From that surface a user cannot tell, without work:

- **which lines a promotion touched** — the grid shows only a status dot; you must select each line and
  read its condition cards to learn a promo even applied to it;
- **that a promotion is a relationship** — "buy 1 get 1 free", "50% off the 2nd piece",
  "buy any sunscreen, get the after-sun free" arrive as a discount amount stapled to a line and a
  separate row in a tab, never as a connected **buy → get**. When the reward is a *different* product,
  or a *grouping* (a category) triggers it, the connection is invisible — the user sees two unrelated
  discounts and has to reconstruct the offer in their head;
- **why a promotion did *not* fire** — the Potential Bonus Buys tab holds the answer (unmet
  prerequisites, found-vs-required) but it lives two tabs away and reads as a raw grid.

The detail advanced users rely on (aggregated condition cards, the statistical toggle, the raw
pricing-elements trace) is good and must not be lost — but it is currently the *only* way to read a
promotion, so every user pays the advanced-user tax.

## Solution

Rework the results-and-promotions surface into the approved **B+C hybrid**: keep the dense flat
per-line grid as the analyst's anchor, and present the promotions themselves as **plain-language
buy → get blocks** that carry everything the old Applied Bonus Buys tab did. From the sketch:

- The **flat grid stays** (column parity for advanced users) and gains a **Promotion** column showing,
  per line, a **kind chip** (Free goods / % off / Amount off / Set price) and a **role tag**
  (buy / get / buy+get) — so promo presence and kind read at a glance, no selection needed.
- Each fired promotion renders as a **block**: a plain-language title ("Buy 1, Get 1 Free"), a
  **Buy box → Get box** relationship (the get box carries the discount kind and the reward amount /
  FREE), and a header line carrying the BBY key, promo no., offer id, remaining usage and total saved.
  Cross-product rewards are tagged "reward"; grouping prerequisites read "Any 2 items from '<category>'".
- **Grid and blocks are linked**: hovering a grid line highlights its promo block and vice-versa,
  keyed on the promotion's **`conditionKey`** (the per-application buy↔get join).
- Promotions that **could have applied but did not** get a **"Could have applied"** section under the
  blocks — the unmet prerequisite as a found-vs-required meter and the would-save figure.
- **Progressive disclosure** is preserved end-to-end: a block expands to today's **condition cards**
  ("Pricing detail"), and an **Advanced detail** toggle adds the raw **pricing-elements** trace and a
  condition-type column on the grid. Nothing today's surface showed is removed — it moves one
  interaction deeper.
- The layout is **responsive**: side-by-side (grid + promo rail) on wide back-office screens, stacked
  (promo blocks as a headline over the grid) when narrower, and a compact **Lines / Promotions** toggle
  on the smallest — chosen by width, not a manual switch.

This requires one **backend projection change** so the client can draw the buy→get relationship
*exactly* rather than by heuristic (see Implementation Decisions).

## User Stories

1. As a pricing analyst, I want to see which result lines a promotion touched without selecting each
   line, so that I can scan a priced basket and immediately know where promotions landed.
2. As a pricing analyst, I want each promoted line to show *what kind* of promotion applied (free
   goods, % off, fixed amount off, set price), so that I can tell a "buy 1 get 1 free" from a
   "50% off the 2nd" at a glance.
3. As a pricing analyst, I want a line to show whether it is the **buy** (trigger), the **get**
   (reward), or **both**, so that I understand its role in the offer.
4. As a pricing analyst, I want each fired promotion presented as a plain-language **buy → get**
   relationship, so that I read the offer as a whole instead of reconstructing it from scattered
   discount amounts.
5. As a pricing analyst, I want a same-SKU "buy 1 get 1 free" to show the trigger piece and the free
   piece as connected on one promotion, so that a 1+1 reads as one offer, not two lines.
6. As a pricing analyst, I want a "second piece 50% off" to show the full-price piece and the
   half-price piece as one promotion, so that the per-piece discount is unambiguous.
7. As a pricing analyst, I want a **cross-product** reward (buy sunscreen → get after-sun free) to show
   the trigger product and the *different* reward product as connected, with the reward tagged as such,
   so that I don't mistake the free line for an unrelated giveaway.
8. As a pricing analyst, I want a **grouping** prerequisite ("any 2 from Baby Care → wipes at a set
   price") to read as "Any 2 items from '<category>'" → the rewarded item, so that a category-triggered
   promo is legible without knowing the category's members by heart.
9. As a pricing analyst, I want each promotion block to carry its BBY key, promo number, offer id,
   remaining usage and total discount, so that nothing the old Applied Bonus Buys tab told me is lost.
10. As a pricing analyst, I want to hover (or focus) a grid line and see its promotion block light up
    — and hover a block and see its grid lines light up — so that I can trace a promotion between the
    two views in either direction.
11. As a pricing analyst, I want a promotion that could have applied but did **not** to appear in a
    "Could have applied" section, so that I can see near-misses without hunting through a separate tab.
12. As a pricing analyst, I want a didn't-fire promotion to show *why* — the unmet prerequisite as a
    found-vs-required meter and the discount it would have granted — so that I can diagnose why an
    expected offer didn't trigger.
13. As a pricing analyst, I want to expand a promotion block to today's aggregated **condition cards**,
    so that the detailed per-line pricing rules stay one click away.
14. As an advanced user, I want an **Advanced detail** toggle that reveals the raw **pricing-elements**
    trace and a condition-type column on the grid, so that the full diagnostic surface I rely on today
    is intact.
15. As an advanced user, I want the statistical-condition rows to remain reachable behind their toggle
    in the condition detail, so that the statistical view I have today is not removed by the rework.
16. As a pricing analyst on a wide screen, I want the grid and the promotion blocks side by side, so
    that I can read both truths at once.
17. As a pricing analyst on a narrower screen, I want the promotion blocks stacked above the grid as
    the headline, so that the layout stays readable without horizontal cramping.
18. As a pricing analyst on a small screen, I want a compact **Lines / Promotions** toggle, so that
    each view gets the full width instead of both being crushed.
19. As a pricing analyst, I want the run summary (net total, gross, promotions total, VAT, promotions
    fired + missed count) to stay visible, so that I keep the headline figures while reading the detail.
20. As a pricing analyst, I want a basket line with **no** promotion to read plainly (an em-dash, no
    chip), so that promoted and un-promoted lines are visually distinct.
21. As a pricing analyst, I want a promotion whose reward is **free** to show "FREE" rather than 0.00,
    so that a free-goods reward is unmistakable.
22. As a pricing analyst, I want a discounted reward to show its new price with the original struck
    through, so that I can see both the before and after per line.
23. As a pricing analyst, I want a single line that is both a prerequisite and its own discounted
    reward (a buy-line set-price) to read as **buy+get** on one promotion, so that self-discounting
    promos aren't mis-split into two.
24. As a pricing analyst, I want a line touched by more than one promotion to associate with each of
    its promotions, so that stacked offers on one line are both traceable.
25. As a back-office user without the pricing grant, I want the screen to stay gated exactly as today
    (`POS_SIMULATION_ADMIN` via `Pricing/Access`), so that the rework changes presentation, not access.
26. As a pricing analyst, when a run returns priced lines but **no** promotions fired and none could
    have, I want the promotions area to say so plainly, so that "nothing fired" is a clear state, not
    an empty panel.
27. As a pricing analyst, I want a per-line pricing **error/warning** (the E/W status) to remain
    visible in the reworked grid, so that a bad line among good ones is still obvious.
28. As a developer, I want the buy→get relationship drawn from an **exact** server-supplied key rather
    than guessed client-side, so that the connector is correct even for many-buy ↔ many-get
    applications across distinct basket rows.

## Implementation Decisions

### Backend — the applied-BBY projection (contract dependency)

The buy→get relationship is **computed but discarded** today. The pricing engine's `PcCondition` rows
carry `IsPrerequisite` / `IsCondition` / `ConditionKey` (the per-application buy↔get join), but
`SimulationResultBuilder` flattens them into `AppliedBonusBuy.affectedItemNumbers`. Surfacing them is a
**pure projection pass-through** (no new computation), owned by the SIS.Pricing / BackOffice server
slice (BackOffice map 484 / spec 503; taxonomy 040 §"target applied contract"):

1. Add `isPrerequisite`, `isCondition`, `conditionKey` (optionally `bbyItemIndex`) to the applied
   condition projection — copied in `MapCondition`.
2. In `BuildAppliedBonusBuys`, group the fired BBY rows by `conditionKey` and split each application
   into **prerequisite (buy)** vs **reward (get)** item lists, instead of the flat
   `affectedItemNumbers`.
3. Normalise applied `discountType` to the clean **P / R / % / N** code (or carry both raw SAP + clean)
   so the four-kind label map applies uniformly to applied and potential promotions.

Until this lands the client renders on a **graceful-degradation path** (see below), so the front-end
work is not hard-blocked on it. This mirrors the NC build's precedent of shipping the client against a
backend contract that a companion server change fulfils.

### Frontend — model & namespace

- **`@/core/models/simulation.ts`**: extend `AppliedBonusBuy` with the split — an `applications`
  array keyed by `conditionKey`, each carrying `buyItemNumbers` / `getItemNumbers` and (for
  buy+get self-discount) the overlap; add a normalised `discountKind: 'N' | '%' | 'R' | 'P'` alongside
  the raw `discountType`. Keep `affectedItemNumbers` for back-compat / the degradation path. Extend
  `SimulationResultCondition` with the optional `isPrerequisite` / `isCondition` / `conditionKey` /
  `bbyItemIndex` fields (all optional so a pre-projection server response still types).
- **i18n**: all new copy under the existing **`simulation`** namespace
  (`src/locales/en/simulation.json`, already registered) — kind labels, role tags, block titles,
  "Could have applied", "Pricing detail", "Advanced detail", the reward "FREE"/"reward" tags, the
  no-promotions-fired empty state. Zero literal rule applies. Block *titles* that summarise an offer
  ("Buy 1, Get 1 Free") are composed from `t()` templates keyed on kind + quantities, not free text;
  server-supplied promo `description` passes through as data.

### Frontend — the view-model seam (the key new module)

A **pure module** turns a `SimulationResult` (with the projected applied fields) into the block/grid
view model — the highest, most testable seam, mirroring the existing pure `aggregate.ts`:

- **`promoView(result)`** (new pure module under `simulation/`): produces
  - `lines[]` — each result item annotated with `{ promoKind, role: 'buy'|'get'|'buy+get'|null,
    conditionKey }` for the grid's Promotion column;
  - `blocks[]` — one per fired promotion (grouped by `bbyNumber`), each with its `applications`
    (buy items → get items from `conditionKey`), `kind`, identity fields (key/promo/offer/usage),
    `totalSaved`, and per-get-line reward amount / free flag;
  - `missed[]` — from `potentialBonusBuys`, each with the driving unmet prerequisite
    (found vs required / min) and the would-save figure.
  - `discountKind` classification maps **N→free, %→percent, R→fixed, P→setprice** (taxonomy 040).
- **Graceful degradation**: when the projected fields are absent (pre-backend-change response), the
  module falls back to `affectedItemNumbers` and renders each promotion as a single undivided block
  (no buy→get split, no cross-highlight partner precision) rather than erroring — so the screen is
  always usable. A flag on the view model records which path was taken.

### Frontend — components

- **`SimulationPage.tsx`**: replace the right-column `SimBonusBuyPanel` tabs + the isolated
  `SimItemDetail` with the hybrid: the flat results grid (gaining the Promotion column) + a promo pane
  rendering the blocks and the "Could have applied" section. Keep the top summary bar; add the
  promotions-fired + missed counts. Layout is responsive (side / stacked / compact-toggle) by width.
- **Grid**: keep AG Grid for the flat lines (column parity), add the Promotion cell renderer
  (kind chip + role tag) and wire hover/focus cross-highlight to the promo blocks via `conditionKey`.
  Preserve the E/W status indication and per-line net/gross-strikethrough.
- **Promo block** component: the buy→get boxes, the header identity line, the reward tags, and the
  disclosure (`Pricing detail` → today's condition cards via the existing aggregation; `Advanced
  detail` → pricing-elements). The condition-card and pricing-elements rendering **reuse** today's
  `aggregate.ts` + `ConditionCard` + the pricing-elements columns — the rework is a re-composition, not
  a re-implementation of the detail.
- **"Could have applied"** section: the didn't-fire blocks with the found-vs-required meter, built from
  `potentialBonusBuys` (which already carries `prerequisites[]` + `isMet`).
- The result-level **Applied Bonus Buys tab is removed** (folded into the blocks); the **Potential
  Bonus Buys** tab folds into "Could have applied"; **Pricing Elements** survives as the Advanced layer.

### No change

- Access gating (`Pricing/Access` / `POS_SIMULATION_ADMIN`), the request shape, the header/input form,
  the items-entry grid, and the manual-conditions grid are untouched (map 039 out-of-scope).

## Testing Decisions

Good tests assert **external behaviour** — the view model a result produces, the copy a user reads —
never internal shape. The rework's logic concentrates in the new pure `promoView` module, which is the
primary seam:

- **Pure / in-memory (highest seam, preferred):** `promoView(result)`. Fixture `SimulationResult`s
  covering every shape the taxonomy enumerates — same-SKU 1+1, 50%-off-2nd, cross-product free reward,
  grouping→set-price, a plain line, a buy+get self-discount, a line under two promotions, and the
  didn't-fire potential — assert the produced `lines` roles/kinds, the `blocks`' buy↔get grouping by
  `conditionKey`, the reward free/amount flags, and `missed` found-vs-required. Add a
  **degradation-path** case: a result lacking the projected fields yields undivided blocks and no
  crash. This module sits beside `aggregate.ts` and follows its "keep it pure so it's the obvious first
  unit" note — it is the natural companion unit to the existing `aggregateConditions` tests-to-be.
- **Component (RTL, when the runner exists):** the promo pane and grid cross-highlight — network stubbed
  at `api.ts` — assert that a promoted line renders its kind chip + role, that a block shows the buy→get
  boxes and identity fields, and that hovering a line marks its block hot. This tier waits on the
  vitest/RTL runner.
- **This feature does not bootstrap the runner.** Per CLAUDE.md the vitest/RTL/Playwright runners are
  not installed (deferred to the hardening ticket). Until then verification is **`npm run typecheck`**
  plus **driving the app** against a live `SIS.Api` — the `/tdd` + `/implement` loop — exactly as
  tickets 013–015 verified. The pure `promoView` module is written test-ready (pure, fixture-driven) so
  that when the runner lands it is the first unit picked up. Prior art for the manual/smoke check:
  `tools/screen1-smoke.mjs`.
- **Backend projection** is verified in its own repo (SIS.Pricing / BackOffice) against the engine's
  `PcCondition` rows; the client's degradation path is what lets the front-end tier proceed before it
  ships.

## Out of Scope

- **The header / input form, items-entry grid, manual-conditions grid** — untouched (map 039).
- **Re-implementing the condition-card / pricing-elements detail** — it is reused as-is; only its
  placement (behind the block disclosure) changes.
- **Editable-grids ticket 016** — an independent open ticket on the same screen; this rework composes
  around it, it is not part of this spec.
- **Any new promotion *computation*** — the engine already computes buy/get/conditionKey; this is
  projection + presentation only, no pricing logic changes.
- **Localisation beyond en** — new keys land in `en` only, wired through i18n like the rest of the app.

## Further Notes

- The backend projection (BackOffice / SIS.Pricing) and the React rework are **two tickets that ship
  together**: the client's graceful-degradation path means the order isn't hard-locked, but the buy→get
  relationship — the whole point of map 039 — only reads exactly once the projection lands. `/to-tickets`
  should slice a **projection** ticket (server contract) and a **surface** ticket (the pure view model
  + the hybrid components), with the surface's exact-relationship behaviour blocked-by the projection
  and its degradation path takeable first.
- The approved sketch ([042-...PROTOTYPE.html](042-sim-promo-hybrid-lock.PROTOTYPE.html)) is the visual
  ground truth for spacing, the kind-chip palette (free=good/green, percent=accent, fixed=warn,
  setprice=info), the buy→get box treatment, and the responsive breakpoints. Its palette already maps
  to the app's `global.css` tokens.
- New-design edge/empty states the sketch didn't fully draw — a many-line promo, several stacked promos
  on one line, a reward line absent from the basket entirely — are refinements for the build to settle,
  not blockers to the approved direction (per 042's hand-off).
