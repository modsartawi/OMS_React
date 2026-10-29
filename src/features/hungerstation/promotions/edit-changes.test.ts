/**
 * Ticket 670 — the Check preview of an in-place edit says what changes on HungerStation: an item that
 * moves from one part to another, items that leave or join, a new part, a part switched off because
 * the edit left it empty. The parts are the SERVER's (BackOffice 3215); this only reads them.
 */
import { describe, expect, it } from 'vitest'
import type { HungerStationPromotionPartChange } from '@/core/models/hungerstation'
import { editChanges } from './edit-changes'

const change = (over: Partial<HungerStationPromotionPartChange>): HungerStationPromotionPartChange => ({
  buyQuantity: 2,
  getQuantity: 1,
  subtype: 'PERCENTAGE',
  value: 50,
  partId: 'pt-a',
  name: 'Eid · B2G1 50%',
  change: 'updated',
  skuCount: 2,
  leaving: [],
  joining: [],
  ...over,
})

describe('editChanges', () => {
  it('a material leaving one part and joining another is ONE move, from → to', () => {
    const s = editChanges([
      change({ partId: 'pt-a', name: 'A', leaving: ['201002'] }),
      change({ partId: null, name: 'C', change: 'new', joining: ['201002'], skuCount: 1 }),
    ])
    expect(s.moved).toEqual([{ materialNumber: '201002', from: 'A', to: 'C' }])
    expect(s.removed).toEqual([])
    expect(s.added).toEqual([])
  })

  it('leaving with no part to join is a removal; joining from nowhere is an addition', () => {
    const s = editChanges([change({ name: 'A', leaving: ['1', '2'], joining: ['9'] })])
    expect(s.removed).toEqual([
      { materialNumber: '1', from: 'A' },
      { materialNumber: '2', from: 'A' },
    ])
    expect(s.added).toEqual([{ materialNumber: '9', to: 'A' }])
  })

  it('sorts the parts by what happens to them, and counts the HungerStation calls', () => {
    const s = editChanges([
      change({ partId: 'pt-a', name: 'A', change: 'unchanged' }),
      change({ partId: 'pt-b', name: 'B', change: 'switchedOff', skuCount: 0, leaving: ['3'] }),
      change({ partId: null, name: 'C', change: 'new', joining: ['3'] }),
      change({ partId: 'pt-d', name: 'D', change: 'updated' }),
    ])
    expect(s.newParts.map((p) => p.name)).toEqual(['C'])
    expect(s.switchedOff.map((p) => p.name)).toEqual(['B'])
    expect(s.updated.map((p) => p.name)).toEqual(['D'])
    expect(s.unchanged).toBe(1)
    // new + updated + switched off: each one HungerStation call.
    expect(s.calls).toBe(3)
    expect(s.any).toBe(true)
  })

  it('an edit that changes no part changes nothing on HungerStation', () => {
    const s = editChanges([change({ change: 'unchanged' })])
    expect(s.any).toBe(false)
    expect(s.calls).toBe(0)
  })
})
