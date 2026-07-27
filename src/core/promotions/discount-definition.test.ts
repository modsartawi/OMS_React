import { describe, expect, it } from 'vitest'

import i18n from '@/core/i18n'
import { discountDefinition, discountKindFromCode, type PromoKind } from './discount-definition'

/**
 * `aDiscountDefinitionReadsInWords` — ticket 161, spec 160 US38.
 *
 * The one rule for putting a discount DEFINITION into words: what an offer
 * *gives* (`20% off`, `3rd free`, `both for 29.95`), never what it would save.
 * It lives in `@/core/` because the Simulation screen's near-miss card and the
 * call-center console's guidance strip (171) ask the identical question, and a
 * feature may never import a feature.
 *
 * The regression this suite exists for is live on a shipping screen: the
 * `01-near-miss-owner-supplied` capture carries `discount: { discountType: '%',
 * value: 35 }` for the promotion `70% 2nd PCS`, and the missed card put that 35
 * through `formatMoney` beside a currency word — `35.00 SAR`, a figure the
 * engine never computed and the customer will never see.
 */
describe('discountDefinition', () => {
  it('states a percent as a percentage, never as an amount', () => {
    // The capture's own value, verbatim (`01-near-miss-owner-supplied`).
    const def = discountDefinition({ kind: 'percent', value: 35 })
    expect(def).toEqual({ key: 'common:discount.percent', params: { value: '35' } })
  })

  it('keeps a fractional percent’s decimals and drops a whole one’s', () => {
    expect(discountDefinition({ kind: 'percent', value: 12.5 })?.params.value).toBe('12.5')
    expect(discountDefinition({ kind: 'percent', value: 70.0 })?.params.value).toBe('70')
  })

  it('states a fixed discount as an amount off, with no currency of its own', () => {
    // `20`, not `20.00`: two forced decimals are the SHAPE that reads as money, and a
    // definition is never money. One formatter serves all four kinds for that reason.
    expect(discountDefinition({ kind: 'fixed', value: 20 })).toEqual({
      key: 'common:discount.fixed',
      params: { value: '20' },
    })
    expect(discountDefinition({ kind: 'fixed', value: 12.5 })?.params.value).toBe('12.5')
  })

  it('states a set price for the pieces it covers', () => {
    // `03-applied-and-potential-owner-supplied`: `2 PC for 29.95 SR`, whose wire
    // value is the ex-VAT 26.04. Two pieces reads `both for …` (138's phrase).
    expect(discountDefinition({ kind: 'setprice', value: 26.04, quantity: 2 })).toEqual({
      key: 'common:discount.setPriceBoth',
      params: { value: '26.04' },
    })
    expect(discountDefinition({ kind: 'setprice', value: 26.04, quantity: 3 })).toEqual({
      key: 'common:discount.setPriceQty',
      params: { value: '26.04', count: 3 },
    })
    // Quantity unknown — the honest phrase drops the count rather than guessing it.
    expect(discountDefinition({ kind: 'setprice', value: 26.04 })).toEqual({
      key: 'common:discount.setPrice',
      params: { value: '26.04' },
    })
  })

  it('states free goods as a count, and as an ordinal when the piece is known', () => {
    expect(discountDefinition({ kind: 'free', value: 1 })).toEqual({
      key: 'common:discount.freeQty',
      params: { count: 1 },
    })
    // `3rd free` — 138's headline phrase. The ordinal is i18next's, not a suffix
    // table in TypeScript: `st/nd/rd/th` is English grammar, and grammar is the
    // translator's, not the resolver's.
    expect(discountDefinition({ kind: 'free', value: 1, nthFree: 3 })).toEqual({
      key: 'common:discount.freeNth',
      params: { count: 3, ordinal: true },
    })
  })

  it('says nothing at all rather than guessing when the kind is unclassified', () => {
    // `promoView` keeps an unmappable discount code honest as `null`; the phrase
    // rule inherits that — the caller falls back to the server's own description.
    expect(discountDefinition({ kind: null, value: 35 })).toBeNull()
  })

  it('says nothing when the kind needs a value the wire did not carry', () => {
    for (const kind of ['percent', 'fixed', 'setprice'] as PromoKind[]) {
      expect(discountDefinition({ kind, value: null })).toBeNull()
      expect(discountDefinition({ kind, value: undefined })).toBeNull()
      // `0% off` and `-3 off` are noise, not definitions — the same guard the figure
      // this replaced carried, with the same consequence: the slot is absent.
      expect(discountDefinition({ kind, value: 0 })).toBeNull()
      expect(discountDefinition({ kind, value: -3 })).toBeNull()
      expect(discountDefinition({ kind, value: Number.NaN })).toBeNull()
    }
    // Free goods with no quantity still HAS a phrase — the offer gives something
    // free, and that is the whole definition.
    expect(discountDefinition({ kind: 'free', value: null })).toEqual({
      key: 'common:discount.free',
      params: {},
    })
  })

  it('never emits a figure carrying a currency word or a money-formatted pair', () => {
    // The narrow rule 138 settled on: not "no `SAR` anywhere" (server descriptions
    // legitimately carry `2 PC for 29.95 SR`), but no figure this module composes
    // may arrive pre-formatted as money. Every emitted value is a bare numeral.
    const every = [
      discountDefinition({ kind: 'percent', value: 35 }),
      discountDefinition({ kind: 'fixed', value: 20 }),
      discountDefinition({ kind: 'setprice', value: 26.04, quantity: 2 }),
      discountDefinition({ kind: 'free', value: 2 }),
    ]
    for (const def of every) {
      for (const param of Object.values(def!.params)) {
        if (typeof param !== 'string') continue
        expect(param).toMatch(/^\d+(\.\d+)?$/)
      }
    }
  })
})

/**
 * The other half of the resolver: a `{ key, params }` pair nothing resolves is a
 * phrase nobody has read. These drive the REAL `i18n` instance the app initialises,
 * so the wording rule is proven end to end — and `common.json`'s plural and ordinal
 * families are proven to be spelled the way i18next reaches them, which a key-shape
 * assertion cannot see.
 */
describe('the phrases, resolved', () => {
  const say = (facts: Parameters<typeof discountDefinition>[0]) => {
    const def = discountDefinition(facts)
    return def && i18n.t(def.key, def.params)
  }

  it('reads the three phrases 138 settled on', () => {
    expect(say({ kind: 'percent', value: 20 })).toBe('20% off')
    expect(say({ kind: 'free', value: 1, nthFree: 3 })).toBe('3rd free')
    expect(say({ kind: 'setprice', value: 29.95, quantity: 2 })).toBe('Both for 29.95')
  })

  it('reads the two live captures the Simulation screen serves', () => {
    // `01-near-miss-owner-supplied` — the regression itself: 35 is a PERCENTAGE.
    expect(say({ kind: 'percent', value: 35 })).toBe('35% off')
    // `03-applied-and-potential-owner-supplied` — `2 PC for 29.95 SR`, wire 26.04,
    // and `Pricing/Simulate` sends no piece count, so the count-less phrase.
    expect(say({ kind: 'setprice', value: 26.04 })).toBe('For 26.04')
  })

  it('reads every ordinal English asks for a different suffix on', () => {
    // The ordinal is i18next's, so `st/nd/rd/th` is data a translator owns. That
    // makes the four ordinal categories a claim about `common.json`, which is
    // exactly the kind of claim that rots silently.
    const nth = (n: number) => say({ kind: 'free', value: 1, nthFree: n })
    expect([nth(1), nth(2), nth(3), nth(4)]).toEqual(['1st free', '2nd free', '3rd free', '4th free'])
    expect([nth(11), nth(21), nth(22), nth(23)]).toEqual([
      '11th free',
      '21st free',
      '22nd free',
      '23rd free',
    ])
  })

  it('reads the counted phrases in both plural forms', () => {
    expect(say({ kind: 'free', value: 1 })).toBe('1 free')
    expect(say({ kind: 'free', value: 2 })).toBe('2 free')
    expect(say({ kind: 'setprice', value: 29.95, quantity: 3 })).toBe('3 for 29.95')
  })

  it('reads the unvalued spellings — free goods, and an amount off', () => {
    expect(say({ kind: 'free', value: null })).toBe('Free')
    expect(say({ kind: 'fixed', value: 20 })).toBe('20 off')
  })

  it('resolves every phrase to real words — no key ever renders as its own key', () => {
    // The zero-literal rule's failure mode: a `t()` call with no backing key renders
    // the key itself to the user. Over every branch this resolver can take.
    const every = [
      { kind: 'percent', value: 35 },
      { kind: 'fixed', value: 20 },
      { kind: 'setprice', value: 26.04 },
      { kind: 'setprice', value: 29.95, quantity: 2 },
      { kind: 'setprice', value: 29.95, quantity: 3 },
      { kind: 'free', value: null },
      { kind: 'free', value: 2 },
      { kind: 'free', value: 1, nthFree: 3 },
    ] as const
    for (const facts of every) {
      const def = discountDefinition(facts)!
      const phrase = i18n.t(def.key, def.params)
      expect(phrase).not.toBe(def.key)
      expect(phrase).not.toContain('discount.')
      expect(phrase).toMatch(/[A-Za-z]/)
    }
  })
})

describe('discountKindFromCode', () => {
  it('maps the taxonomy’s four clean codes', () => {
    expect(discountKindFromCode('N')).toBe('free')
    expect(discountKindFromCode('%')).toBe('percent')
    expect(discountKindFromCode('R')).toBe('fixed')
    expect(discountKindFromCode('P')).toBe('setprice')
  })

  it('leaves an unknown or absent code unclassified rather than guessing', () => {
    expect(discountKindFromCode('Z')).toBeNull()
    expect(discountKindFromCode(null)).toBeNull()
    expect(discountKindFromCode(undefined)).toBeNull()
    expect(discountKindFromCode('')).toBeNull()
  })
})
