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
  // Added to the 123 ledger by slice 120: the failure banner carries the route to
  // the fault, and the manual-conditions disclosure carries a count on its label.
  // The ledger anticipated neither — 120's boundary sends new copy here rather
  // than to an ad-hoc key beside the call site.
  'banner.routeItems',
  'banner.routeSettings',
  'manual.count_one',
  'manual.count_other',
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
  'results.status',
  'results.promoNone.mark',
  'results.promoNone.label',
  'results.material',
  'results.description',
  'results.gross',
  'results.promo',
  'results.net',
  'results.subtotal',
  'results.tax',
  'banner.counts',
  'summary.netTotal',
  'summary.elapsed',
  'status.ok',
  'detail.records',
  'detail.subRate',
  // Lost its call site to slice 120 — the work area no longer draws a framed
  // "No priced lines yet." box before a run, it draws one line of `summary.noResult`.
  // The KEY stays until 121's contract half, like every other entry here.
  'results.empty',
]

/**
 * The contract half, as far as it has run. Ticket 113 dissolved the Header form,
 * the Summary tile and the Actions card into the run strip, so these three frame
 * headings retired WITH their call sites — the rest of the sweep is 121's.
 */
const RETIRED_KEYS = ['header.title', 'summary.title', 'actions.title']

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
    // `results.subtotal`'s natural rename is `results.net` — occupied today by a different
    // figure. The five money keys mint fresh so no half-finished sweep can resolve to
    // plausible English about the wrong number.
    const collisions = NEW_KEYS.filter((path) => RETIRING_KEYS.includes(path))
    expect(collisions).toEqual([])
  })
})
