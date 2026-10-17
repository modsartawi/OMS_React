/**
 * Tickets 505 / 522 — the palette offers only what the campaign's features switch on, never a block
 * the catalogue marks "not decided", and a pick adds a schema-1 block (`check` / `effect`, no id).
 */
import { describe, expect, it } from 'vitest'
import type { RuleFeature } from '@/core/models/rule-campaign'
import { CATALOGUE } from '../../../../tools/campaigns-fixtures.mjs'
import { newBlock, newRule, paletteFor } from './palette'

const types = (kind: 'condition' | 'effect', features: RuleFeature[]) =>
  paletteFor(CATALOGUE, kind, features).groups.flatMap((g) => g.blocks.map((b) => b.type))
const block = (type: string) => CATALOGUE.blocks.find((b) => b.type === type)!

describe('palette', () => {
  it('palette_gatesPointsAndCouponBlocks_byFeature_andHidesNotDecided', () => {
    expect(types('condition', [])).not.toContain('coupon')
    expect(types('condition', [])).not.toContain('minPoints')
    expect(types('effect', [])).not.toContain('awardPoints')
    expect(types('effect', [])).not.toContain('burnPoints')
    expect(types('condition', ['coupons'])).toContain('coupon')
    expect(types('condition', ['coupons'])).not.toContain('minPoints')
    expect(types('condition', ['coupons', 'points'])).toEqual(expect.arrayContaining(['coupon', 'minPoints']))
    expect(types('effect', ['coupons', 'points'])).toEqual(expect.arrayContaining(['awardPoints', 'burnPoints', 'createCoupon']))
    // Not decided: left out whatever the features say.
    for (const f of [[], ['coupons', 'points']] as RuleFeature[][]) expect(types('condition', f)).not.toContain('audience')
    const all = paletteFor(CATALOGUE, 'condition', ['coupons', 'points']).groups.flatMap((g) => g.blocks)
    expect(all.every((b) => b.decided && b.kind === 'condition')).toBe(true)
  })

  it('says which features are off and would add blocks', () => {
    expect(paletteFor(CATALOGUE, 'condition', []).hiddenFeatures.sort()).toEqual(['coupons', 'points'])
    expect(paletteFor(CATALOGUE, 'effect', ['coupons', 'points']).hiddenFeatures).toEqual([])
  })

  it('offers the formula condition, written with the guided fx helper (507)', () => {
    expect(types('condition', [])).toContain('formula')
  })

  it('a pick adds a schema-1 block with its defaults and no id', () => {
    const rule = { filters: [{ id: 'f-sun', name: 'sun' }] }
    expect(newBlock(block('minSubtotal'), rule)).toEqual({ check: 'minSubtotal', basis: 'subtotal', says: { en: '', ar: '' } })
    expect(newBlock(block('discountItems'), rule)).toEqual({ effect: 'discountItems', kind: 'percent', filter: 'f-sun', scope: 'items', label: { en: '', ar: '' } })
    expect(newBlock(block('group'), rule)).toMatchObject({ check: 'group', mode: 'all', conditions: [] })
    expect(newBlock(block('minCount'), { filters: [] })).not.toHaveProperty('of')
  })

  it('a new rule is empty and reads "always"', () => {
    expect(newRule('r9')).toEqual({ id: 'r9', name: '', filters: [], values: [], when: [], then: [] })
  })
})
