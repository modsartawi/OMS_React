import { describe, expect, it } from 'vitest'

import simulation from '@/locales/en/simulation.json'
// The ledger is plain `.mjs` — the one shape a Node gate with no build step and a
// TypeScript test can BOTH read — with a `.d.mts` beside it carrying its types.
import { RETIRED, RETIRED_MONEY, UPPERCASE } from '../../../../tools/sim-key-ledger.mjs'

/** The keys minted by ticket 123 — the expand half of the rework's expand–contract. */
const NEW_KEYS = [
  'results.pos',
  'results.was',
  'results.saved',
  'results.netTotal',
  'results.expandNet',
  'results.expandTax',
  'results.expandTotal',
  'results.unitPrice',
  'results.fired',
  'results.notPriced',
  'results.elementsTitle',
  'detail.stat',
  'promotions.lines',
  'promo.bbyDetails',
  'promo.notMeasured',
  'strip.netTotal',
  'strip.edit',
  // Added to the 123 ledger by slice 113: the chip set reads `Done ▴` while the
  // form is open, and the ledger had minted only its collapsed half.
  'strip.done',
  'strip.stale',
  'strip.key.plant',
  'strip.key.org',
  'strip.key.chan',
  'strip.key.proc',
  'strip.key.loy',
  'strip.key.tier',
  'strip.key.elem',
  'strip.promoOn',
  'strip.promoOff',
  // Added to the 123 ledger by slice 120: the failure banner carries the route to
  // the fault, and the manual-conditions disclosure carries a count on its label.
  // The ledger anticipated neither — 120's boundary sends new copy here rather
  // than to an ad-hoc key beside the call site.
  'banner.routeItems',
  'banner.routeSettings',
  'manual.count_one',
  'manual.count_other',
]

/**
 * The retirements and the uppercase inventory come from ONE place —
 * `tools/sim-key-ledger.mjs`, which `tools/check-sim-keys.mjs` reads too. The two halves
 * are deliberately different (that script sweeps CALL SITES and unreferenced keys; this
 * asserts the JSON), but a ledger maintained twice can go green on a stale copy, which is
 * the one failure the expand–contract argument cannot survive.
 *
 * The list includes the keys 123 deliberately LEFT STANDING so no slice between it and
 * 121 could half-retire one. They leave together in one pass, once nothing is moving.
 *
 * The five money keys are why a ledger exists rather than a rename sweep.
 * `results.subtotal`'s natural rename is `results.net` — occupied, by a DIFFERENT figure.
 * A rename onto an occupied key is the one shape the zero-literal rule cannot protect: a
 * half-finished sweep leaves a key that resolves, renders plausible English, and is about
 * the wrong number — strictly worse than a raw key, which is at least visibly broken. So
 * all five retired and 123's replacements were minted fresh.
 */

function resolve(path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (node, segment) =>
        node && typeof node === 'object'
          ? (node as Record<string, unknown>)[segment]
          : undefined,
      simulation,
    )
}

describe('simulation namespace — the expand step', () => {
  it.each(NEW_KEYS)('%s resolves to a non-empty string', (path) => {
    const value = resolve(path)
    expect(typeof value).toBe('string')
    expect(value).not.toBe('')
    expect(value).not.toBe(path)
  })

  it.each(RETIRED)('%s is gone — it retired with the surface it named', (path) => {
    expect(resolve(path)).toBeUndefined()
  })

  it.each(UPPERCASE)('%s is authored uppercase in the value', (path) => {
    const value = resolve(path) as string
    // A value with no cased letter (`—`, `#`, `123`) equals its own upper-case and
    // would pass vacuously — the constraint is that a LETTER was authored upper.
    expect(value).toMatch(/[A-Za-z]/)
    expect(value).toBe(value.toUpperCase())
  })

  it('promotions.lines carries its interpolation slot', () => {
    expect(resolve('promotions.lines')).toContain('{{lines}}')
  })

  it('the fresh money keys are minted beside the occupied ones, never onto them', () => {
    // The invariant behind the mint-fresh ruling: no key the sweep RETIRES is also a
    // key the new line reads. If one were, a half-finished sweep would leave a key that
    // resolves and renders plausible English about the wrong number.
    const collisions = NEW_KEYS.filter(
      (path) => RETIRED.includes(path),
    )
    expect(collisions).toEqual([])
  })

  it('the retired money keys are gone from the call sites too, not just the JSON', () => {
    // 121's close-out is the backstop for the whole screen; the five money keys are
    // this slice's own, because a resolving key about the wrong number is the failure
    // mode, and it survives a JSON-only sweep.
    for (const path of RETIRED_MONEY) expect(resolve(path)).toBeUndefined()
  })
})
