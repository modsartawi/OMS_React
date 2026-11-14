import { describe, expect, it } from 'vitest'
import type { HeldImpactPair } from '@/core/models/held-stock-report'
import { HELD_DEFAULTS, heldFiltersFromParams, heldFiltersToParams, heldQuery, pairsShown, unitsFrom } from './held'

describe('the held report URL', () => {
  it('writes nothing for the defaults: the fleet, the last 7 days of repairs, every pair', () => {
    expect(heldFiltersToParams(HELD_DEFAULTS).toString()).toBe('')
    expect(heldFiltersFromParams(new URLSearchParams())).toEqual(HELD_DEFAULTS)
  })

  it('round-trips the tab, the stores, the repairs range, the falls-to-zero filter and the source type', () => {
    const filters = {
      tab: 'repairs' as const,
      stores: 'P001,P002',
      repairsFrom: '2026-11-01',
      repairsTo: '2026-11-10',
      falling: true,
      source: 'DRS',
    }
    expect(heldFiltersFromParams(heldFiltersToParams(filters))).toEqual(filters)
  })

  it('reads an impossible date, an unknown tab or a junk flag as the default, and tidies the stores and the source', () => {
    const read = heldFiltersFromParams(
      new URLSearchParams('tab=nope&repairsFrom=2026-02-30&repairsTo=x&falling=yes&stores=p002 p001&source= drs '),
    )
    expect(read).toEqual({ ...HELD_DEFAULTS, stores: 'P002,P001', source: 'DRS' })
  })
})

describe('the held read', () => {
  it('asks for the stores and the repairs range as set, and leaves out what the door defaults', () => {
    expect(heldQuery({ ...HELD_DEFAULTS, stores: 'P001', repairsFrom: '2026-11-01', repairsTo: '2026-11-07' })).toEqual({
      stores: 'P001',
      repairsFrom: '2026-11-01',
      repairsTo: '2026-11-07',
    })
    // The pair filters and the tab are the screen's own: they never re-read Stock Visibility.
    expect(heldQuery({ ...HELD_DEFAULTS, falling: true, source: 'DRS', tab: 'sources' })).toEqual({})
  })
})

const pair = (store: string, material: string, fallsToZero: boolean, bySource: [string, number][]): HeldImpactPair => ({
  store,
  material,
  channelToday: 10,
  held: 4,
  channelWithHeld: 6,
  takenOff: 4,
  fallsToZero,
  bySource: bySource.map(([sourceType, units]) => ({ sourceType, units })),
  heldBeyondOpenPicks: 0,
})

const PAIRS = [
  pair('P001', 'M1', false, [['DRS', 2], ['WEB', 1]]),
  pair('P001', 'M2', true, [['WEB', 3]]),
  pair('P002', 'M1', true, [['DRS', 5]]),
]

describe('the pairs shown', () => {
  it('keeps the pairs that would fall to zero, and the pairs a source type holds on, together or apart', () => {
    expect(pairsShown(PAIRS, { ...HELD_DEFAULTS, falling: true }).map((p) => `${p.store}/${p.material}`)).toEqual([
      'P001/M2',
      'P002/M1',
    ])
    expect(pairsShown(PAIRS, { ...HELD_DEFAULTS, source: 'DRS' }).map((p) => `${p.store}/${p.material}`)).toEqual([
      'P001/M1',
      'P002/M1',
    ])
    expect(pairsShown(PAIRS, { ...HELD_DEFAULTS, falling: true, source: 'DRS' }).map((p) => `${p.store}/${p.material}`)).toEqual([
      'P002/M1',
    ])
    expect(pairsShown(PAIRS, HELD_DEFAULTS)).toHaveLength(3)
  })

  it('reads a pair’s units from one source type, and a source that holds nothing there as zero', () => {
    expect(unitsFrom(PAIRS[0], 'DRS')).toBe(2)
    expect(unitsFrom(PAIRS[1], 'DRS')).toBe(0)
  })
})
