import { describe, expect, it } from 'vitest'

import simulation from '@/locales/en/simulation.json'

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
]

/** Keys the rework retires later (ticket 121's close-out) — they must survive the expand step. */
const RETIRING_KEYS = [
  'detail.title',
  'detail.tiles.base',
  'detail.tiles.discounts',
  'detail.tiles.tax',
  'detail.tiles.net',
  'detail.showStatistical',
  'detail.hideStatistical',
  'bonus.tabs.elements',
  'bonus.elements.empty',
  'summary.netTotal',
  'summary.elapsed',
  'detail.records',
  'detail.subRate',
]

/**
 * The contract half, as far as it has run. Ticket 113 dissolved the Header form,
 * the Summary tile and the Actions card into the run strip, so these three frame
 * headings retired WITH their call sites; ticket 115 rebuilt the result line, which
 * retires the five money labels, the status column, the promo-none em-dash, the two
 * halves of the merged Item column, the E/W count banner and the healthy-line label.
 * The rest of the sweep is 121's.
 *
 * The five money keys are the reason this list exists rather than a rename sweep.
 * `results.subtotal`'s natural rename is `results.net` — occupied, by a DIFFERENT
 * figure. A rename onto an occupied key is the one shape the zero-literal rule cannot
 * protect: a half-finished sweep leaves a key that resolves, renders plausible
 * English, and is about the wrong number — strictly worse than a raw key, which is at
 * least visibly broken. So all five retired and 123's replacements minted fresh.
 */
const RETIRED_KEYS = [
  'header.title',
  'summary.title',
  'actions.title',
  // 115 — the money labels of the old order (subtotal · promo · gross · tax · net).
  'results.subtotal',
  'results.promo',
  'results.gross',
  'results.tax',
  'results.net',
  // 115 — the status column, the promo-none mark, the split Item column, the banner.
  'results.status',
  'results.promoNone.mark',
  'results.promoNone.label',
  'results.material',
  'results.description',
  'banner.counts',
  // 115 — a healthy line renders no label at all, so `OK` has no call site.
  'status.ok',
]

/** Values that must carry their own uppercase — a CSS transform is a no-op on Arabic script. */
const UPPERCASE_KEYS = [
  'strip.key.plant',
  'strip.key.org',
  'strip.key.chan',
  'strip.key.proc',
  'strip.key.loy',
  'strip.key.tier',
  'strip.key.elem',
  'detail.stat',
  'detail.badge.promotion',
  'detail.badge.manual',
  'detail.badge.header',
  'promo.free',
]

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

  // Some of these have already lost their call site (113 moved `summary.netTotal`
  // to `strip.netTotal`); the KEYS stay until 121's contract half sweeps them,
  // which is what "expand, then contract" means.
  it.each(RETIRING_KEYS)('%s is still present — the contract half belongs to 121', (path) => {
    expect(typeof resolve(path)).toBe('string')
  })

  it.each(RETIRED_KEYS)('%s is gone — it retired with the frame it titled (113)', (path) => {
    expect(resolve(path)).toBeUndefined()
  })

  it.each(UPPERCASE_KEYS)('%s is authored uppercase in the value', (path) => {
    const value = resolve(path) as string
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
      (path) => RETIRED_KEYS.includes(path) || RETIRING_KEYS.includes(path),
    )
    expect(collisions).toEqual([])
  })

  it('the retired money keys are gone from the call sites too, not just the JSON', () => {
    // 121's close-out is the backstop for the whole screen; the five money keys are
    // this slice's own, because a resolving key about the wrong number is the failure
    // mode, and it survives a JSON-only sweep.
    const retiredMoney = ['results.subtotal', 'results.promo', 'results.gross', 'results.tax', 'results.net']
    for (const path of retiredMoney) expect(resolve(path)).toBeUndefined()
  })
})
