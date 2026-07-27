// THE discount-definition wording rule (ticket 161, spec 160 US38 / 574 US26).
//
// How a promotion's discount kind plus its value becomes a phrase — `20% off`,
// `3rd free`, `both for 29.95`. It is the answer to "what does this offer GIVE?",
// and it is deliberately NOT the answer to "what would it save?": a savings total
// requires firing the promotion, so no honest surface can print one and no
// client-side equivalent may replace it.
//
// It lives in `@/core/` because two features ask the identical question — the
// Simulation screen's near-miss card (`features/pricing/simulation`) and the
// call-center console's guidance strip (ticket 171) — and a feature may never
// import a feature (`.claude/rules/feature-structure.md`). Only the wording rule
// graduated: the rest of `promo-view.ts` is built on `SimulationResult`, which
// the console does not consume.
//
// Pure and i18n-free in the `codeLabels` precedent's shape: it returns a KEY plus
// its interpolation params, and the render tier resolves them with `t()`. Keys are
// namespace-qualified (`common:…`) so a caller in any namespace can resolve one
// without knowing where it lives.

/** The four discount kinds (taxonomy 040): `N`→free, `%`→percent, `R`→fixed,
 *  `P`→setprice. `null` when a code can't be classified — kept honest, not guessed. */
export type PromoKind = 'free' | 'percent' | 'fixed' | 'setprice'

/** A resolved phrase: the i18n key, and the arguments `t()` needs to resolve it —
 *  interpolation values plus, where the phrase is an ordinal, i18next's own
 *  `ordinal` option. Nothing here is user-visible text. */
export interface DiscountDefinition {
  key: string
  params: Record<string, string | number | boolean>
}

/** What a promotion's discount is known to be. */
export interface DiscountFacts {
  kind: PromoKind | null
  /** What the kind says it is: a PERCENTAGE for `percent`, an amount for `fixed`
   *  and `setprice`, a free quantity for `free`. That the unit rides the kind — and
   *  that nobody had written it down — is the whole of the defect this module ends:
   *  a `%` value of 35 reached a money formatter and rendered `35.00 SAR`. */
  value: number | null | undefined
  /** How many pieces a set price covers (`2 PC for 29.95` → 2), when the wire says. */
  quantity?: number | null
  /** Which piece the free goods land on (`3rd free`), when the wire says. */
  nthFree?: number | null
}

/**
 * A clean discount code (`N` / `%` / `R` / `P`) → its kind. An unknown or absent
 * code is `null` rather than a guess, so a card falls back to the server's own
 * description instead of inventing one. Raw SAP condition codes (`ZB03`, `VKA0`)
 * are a Simulation-only concern and stay with that feature's projection.
 */
export function discountKindFromCode(code: string | null | undefined): PromoKind | null {
  switch (code) {
    case 'N':
      return 'free'
    case '%':
      return 'percent'
    case 'R':
      return 'fixed'
    case 'P':
      return 'setprice'
    default:
      return null
  }
}

/**
 * The phrase for a discount definition, or `null` when there is nothing honest to
 * say — an unclassified kind, or a kind whose value the wire did not carry. Free
 * goods are the one kind that still has a phrase without a value: the offer gives
 * something free, and that IS the definition.
 */
export function discountDefinition(facts: DiscountFacts): DiscountDefinition | null {
  const { kind, quantity, nthFree } = facts
  if (!kind) return null

  // A value that isn't a positive finite number says nothing: `0% off` and `-3 off`
  // are noise, not definitions. The card the rule replaced had the same guard on the
  // figure it printed, and dropping the slot entirely is what it did with it.
  const raw = facts.value
  const value = typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : null

  switch (kind) {
    case 'percent':
      return value == null ? null : { key: 'common:discount.percent', params: { value: numeral(value) } }

    case 'fixed':
      return value == null ? null : { key: 'common:discount.fixed', params: { value: numeral(value) } }

    case 'setprice': {
      if (value == null) return null
      const params = { value: numeral(value) }
      // `both for 29.95` is the two-piece phrase 138 settled on; three or more
      // counts them; an unknown count drops the number rather than guessing it.
      if (quantity === 2) return { key: 'common:discount.setPriceBoth', params }
      if (typeof quantity === 'number' && quantity > 0)
        return { key: 'common:discount.setPriceQty', params: { ...params, count: quantity } }
      return { key: 'common:discount.setPrice', params }
    }

    case 'free': {
      // `3rd free` — the ordinal is i18next's (`ordinal: true`), never a `st/nd/rd`
      // suffix table in TypeScript: that is English grammar, and grammar belongs to
      // the translator, not to a resolver that will one day serve Arabic.
      if (typeof nthFree === 'number' && nthFree > 0)
        return { key: 'common:discount.freeNth', params: { count: nthFree, ordinal: true } }
      if (value != null && value > 0) return { key: 'common:discount.freeQty', params: { count: value } }
      return { key: 'common:discount.free', params: {} }
    }
  }
}

/**
 * Every figure in a definition, formatted the one way: a bare numeral, rounded to
 * two places, keeping only the decimals it has — `70`, `12.5`, `29.95`, `20`.
 *
 * ONE formatter for all four kinds, deliberately. Two would have to decide which
 * values are money, and that decision is what went wrong: `35.00` is the SHAPE that
 * reads as money — two forced decimals, ready for a currency word beside it — and
 * a definition is never money. It states what an offer gives, not what a caller
 * pays, so it carries no currency and no unit of its own; the unit, where there is
 * one, belongs to the phrase (`{{value}}% off`).
 */
function numeral(value: number): string {
  return String(Number(value.toFixed(2)))
}
