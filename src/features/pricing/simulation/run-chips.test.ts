import { describe, expect, it } from 'vitest'
import type { SimulateRequest } from '@/core/models/simulation'
import { runChips } from './run-chips'

/**
 * The run strip's chip set (ticket 113, spec 110) — the determination the run
 * actually used, as `{ key, value }` TOKENS rather than translated strings, so
 * the rule is node-testable and the zero-literal rule stays intact.
 *
 * The counts under test are the ones 100/102 ruled against the 098 captures:
 * five chips ordinarily, eight with the three test levers, nine with the
 * pricing-elements flag.
 */

/** The ordinary run: the header defaults every capture in the 098 corpus used. */
function request(patch: Partial<SimulateRequest['header']> = {}): SimulateRequest {
  return {
    header: {
      plant: 'P001',
      salesOrganization: '1000',
      distributionChannel: '20',
      pricingDate: '2026-07-25T00:00:00',
      documentPricingProcedureKey: '',
      loyGroups: null,
      loyTier: null,
      isPromotionApplicable: true,
      ...patch,
    },
    items: [{ materialNumber: '107255', quantity: 2, qtyUnit: 'EA', itemConditionControl: null }],
    includeConditions: true,
    includePricingElements: false,
  }
}

describe('runChips reads the determination a run actually used', () => {
  it('is five chips ordinarily — the four determination fields and the promotion flag', () => {
    const chips = runChips(request())
    expect(chips).toEqual([
      { kind: 'keyed', key: 'plant', value: 'P001' },
      { kind: 'keyed', key: 'org', value: '1000' },
      { kind: 'keyed', key: 'chan', value: '20' },
      { kind: 'date', value: '25 Jul 2026' },
      { kind: 'promo', on: true },
    ])
  })

  it('chips the determination fields even when they hold their defaults', () => {
    // 098 finding 8: an invalid plant prices silently, so the determination must
    // be readable without expanding anything. "Ordinary" and "not shown" would
    // otherwise be the same strip.
    const chips = runChips(request())
    expect(chips.filter((c) => c.kind === 'keyed').map((c) => c.key)).toEqual([
      'plant',
      'org',
      'chan',
    ])
  })

  it('is eight chips when the three test levers are set', () => {
    const chips = runChips(
      request({ documentPricingProcedureKey: 'W', loyGroups: '0001', loyTier: 'G' }),
    )
    expect(chips).toHaveLength(8)
    expect(chips.slice(5)).toEqual([
      { kind: 'keyed', key: 'proc', value: 'W' },
      { kind: 'keyed', key: 'loy', value: '0001' },
      { kind: 'keyed', key: 'tier', value: 'G' },
    ])
  })

  it('is nine chips when the pricing-elements flag is on, and the flag chips key-only', () => {
    const chips = runChips({
      ...request({ documentPricingProcedureKey: 'W', loyGroups: '0001', loyTier: 'G' }),
      includePricingElements: true,
    })
    expect(chips).toHaveLength(9)
    // Presence IS the state: the flag chips only when on, so a value slot would
    // repeat what the chip's existence already says.
    expect(chips[8]).toEqual({ kind: 'flag', key: 'elem' })
  })

  it('gives a blank lever no chip at all — never a muted empty one', () => {
    // 083 D-3 / 100 §4. Every spelling of "unset" the request can carry.
    for (const blank of ['', '   ', null]) {
      const chips = runChips(
        request({ documentPricingProcedureKey: blank ?? '', loyGroups: blank, loyTier: blank }),
      )
      expect(chips).toHaveLength(5)
    }
  })

  it('chips the promotion flag in both states', () => {
    // 098 finding 3: promo-off blacks out the whole rail, and a blacked-out rail
    // must never read as "nothing fired".
    expect(runChips(request({ isPromotionApplicable: false })).at(4)).toEqual({
      kind: 'promo',
      on: false,
    })
  })

  it('carries no key on the date chip — a formatted date reads alone', () => {
    const chips = runChips(request({ pricingDate: '2026-01-05T00:00:00' }))
    expect(chips[3]).toEqual({ kind: 'date', value: '05 Jan 2026' })
  })

  it('drops the date chip when the run carries no date, because the engine then prices at "now"', () => {
    // A blank date is not a default — it is the absence of a determination, and
    // a bare chip with no text would render as an empty pill.
    expect(runChips(request({ pricingDate: '' }))).toHaveLength(4)
  })

  it('trims the values it chips so a stray space never widens the strip', () => {
    const chips = runChips(request({ plant: ' P002 ', loyGroups: ' 0001 ' }))
    expect(chips[0]).toEqual({ kind: 'keyed', key: 'plant', value: 'P002' })
    expect(chips.at(-1)).toEqual({ kind: 'keyed', key: 'loy', value: '0001' })
  })
})
