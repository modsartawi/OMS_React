---
status: done
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

- [x] `aDiscountDefinitionReadsInWords` — every `PromoKind` × value produces its phrase through the
      label resolver, and a **percent never renders through a money formatter**; the regression case
      is the 70%-off promotion that reads `70.00 SAR` today · pure
      → `src/core/promotions/discount-definition.test.ts` (16 tests). Two halves: the resolver
      emits `{ key, params }`, and a second suite drives the REAL `@/core/i18n` instance so the
      three phrases 138 settled (`20% off`, `3rd free`, `Both for 29.95`) are proven as WORDS, not
      as key shapes — which also pins `common.json`'s plural and ordinal families, the part a
      key-shape assertion cannot see. Money never enters: one `numeral()` formatter serves all four
      kinds, so `35.00` (the shape that reads as money) cannot be produced at all.
- [x] `theMissedCardPromisesNoTotal` — the view model exposes no savings figure at all, so a future
      caller cannot re-introduce one by reading a field · pure
      → `src/features/pricing/simulation/promo-view.test.ts`. The strong form: over EVERY capture
      in the corpus, a missed entry carries no numeric property at all, not merely no `wouldSave`.
- [x] Simulation's missed-promotions card renders the definition where the money used to be ·
      verify via `typecheck` + drive (`tools/sim-*-drive.mjs` covers this screen)
      → `tools/sim-rail-drive.mjs` **35/35**, extended with the regression capture itself
      (`01-near-miss-owner-supplied`, the `%` near-miss): the card reads `GIVES 35% off`, and
      neither `35.00` nor a `would save` label survives anywhere. The set-price capture asserts the
      NARROW rule — the server's own `2 PC for 29.95 SR` is untouched, while no figure the client
      composes carries a currency word. `tools/sim-rtl-drive.mjs` 29/29 re-run (the phrase opens
      with a digit, so it is bidi-isolated); `npm test` 326/326, `typecheck`, `lint`, `build`, and
      `node tools/check-sim-keys.mjs` 8/8 all green.

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

## Comments

**Built 2026-07-27.** The rule lives at `src/core/promotions/discount-definition.ts`:
`discountDefinition({ kind, value, quantity?, nthFree? })` → `{ key, params }` for `t()`, plus
`discountKindFromCode` (the taxonomy's `N`/`%`/`R`/`P` map, which graduated with it) and the
`PromoKind` type, which `promo-view.ts` now re-exports rather than owns. Keys are namespace-
qualified (`common:discount.*`) so a caller in any namespace resolves one without knowing where it
lives — the `codeLabels` precedent, one step further.

Three decisions worth carrying into [171](171-guidance-strip-three-classes.md):

1. **One formatter, not two.** The first cut had `percent()` and `amount()`. Two formatters have to
   decide which values are money, and *that decision is the defect* — so there is one `numeral()`,
   emitting a bare rounded numeral (`70`, `12.5`, `29.95`, `20`). `20.00` is never produced, because
   two forced decimals are the shape that reads as money whether or not a currency word follows.
   A `DISCOUNT_VALUE_UNIT` map was drafted to make the unit checkable and then **cut**: with no
   money formatter in the module it had no caller and no enforcing power, and the ticket's
   "narrow on purpose" ruling covers exactly that.
2. **The ordinal is i18next's** (`{ count, ordinal: true }` → `freeNth_ordinal_one|two|few|other`),
   never a `st/nd/rd` suffix table in TypeScript — that is English grammar, and grammar belongs to
   the translator. `quantity` and `nthFree` are inputs `Pricing/Simulate` never supplies
   (`PotentialDiscount` carries neither), so the Simulation card resolves the count-less spellings;
   they exist because 138 named `3rd free` and `both for 29.95` as required phrases, and they are
   proven through the real i18n instance rather than left as untested keys.
3. **A zero or negative value says nothing.** `0% off` is noise, not a definition — the slot is
   absent, the same consequence the retired figure's `> 0` guard had.

On the card, the definition took the retired figure's slot under a `GIVES` label (authored
uppercase in the JSON, not CSS-transformed). **It is not yet the headline** 138 ruled it must be —
that is 171's, on the console's own card; this ticket asked only for the definition "where the
money used to be". `SimMissedPromotions` no longer takes a `currency` prop at all: the invented
figure was the only money on it.
