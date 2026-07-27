---
status: open
spec: 160
blocked-by: —
---

# 161 — aPercentStopsBeingPrintedAsMoney

## What to build

**Prefactor, and a live bug fix on a shipping screen.** The Simulation screen's missed-promotion
card currently renders a **percentage as currency**: `promo-view.ts` sets `wouldSave` to
`discount.value`, and `SimMissedPromotions` puts that through `formatMoney` under a *Would save*
label — so a 70%-off promotion reads as **`70.00 SAR`**, a number the engine never computed and the
customer will never see.

Two things change, together:

1. **The card stops promising a saving it cannot know.** A missed promotion says what the offer
   **gives** — the discount *definition* — not what it would save. A savings total requires firing
   the promotion (spec 574 US26); `wouldSave` is not that, and no client-side equivalent may replace
   it.
2. **The discount-definition wording becomes one rule, in `@/core/`.** How a `PromoKind`
   (`free · percent · fixed · setprice`) plus its value is put into words — `20% off`, `3rd free`,
   `both for 29.95` — is the same question the call-center console's guidance strip asks
   ([171](171-guidance-strip-three-classes.md)), and a feature may never import a feature. It
   graduates as a **pure module in `@/core/`** with its own suite.

**Narrow on purpose** (ruled 2026-07-27): only the definition-wording rule graduates. The rest of
`promo-view.ts` is built on `SimulationResult` / `PotentialBonusBuy`, which the console does not
consume — its `nearMisses` are `AvailableOffer`-shaped — so moving the whole module would be
speculative. Map 126 note 13's "graduates wholesale" is deliberately narrowed here; if 171 turns out
to need more, it takes more then.

## Spine reach

logic (new pure `@/core/` definition-wording module; `promo-view`'s `wouldSave` retired) ·
component (`SimMissedPromotions` renders the definition instead of a fabricated total) ·
i18n (`simulation`: `missed.wouldSaveLabel` retired, definition keys added) · test (pure)

## Proof (→ `tdd` red-green cycles)

- [ ] `aDiscountDefinitionReadsInWords` — every `PromoKind` × value produces its phrase through the
      label resolver, and a **percent never renders through a money formatter**; the regression case
      is the 70%-off promotion that reads `70.00 SAR` today · pure
- [ ] `theMissedCardPromisesNoTotal` — the view model exposes no savings figure at all, so a future
      caller cannot re-introduce one by reading a field · pure
- [ ] Simulation's missed-promotions card renders the definition where the money used to be ·
      verify via `typecheck` + drive (`tools/sim-*-drive.mjs` covers this screen)

## Boundaries

No endpoint. Touches a **shipping screen** (`features/pricing/simulation`) — the existing
`promo-lines` / `line-money` suites must stay green, and the drive for that screen re-run. New
`@/core/` module ⇒ the import-boundary lint gate applies (core may never import a feature). i18n:
one key retired, definition keys added in the same change.

## Done when

The Simulation screen states what a missed promotion gives instead of a saving it invented, no code
path renders a percentage through a money formatter, and the wording rule sits in `@/core/` with its
own passing suite.

## Blocked by

None — can start immediately.
