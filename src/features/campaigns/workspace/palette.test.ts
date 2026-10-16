/**
 * Ticket 505 — the palette offers only what the campaign's features switch on, never a block the
 * catalogue marks "not decided", and a pick adds a block with every catalogue field present.
 */
import { describe, expect, it } from 'vitest'
import type { RuleCampaignFeatures } from '@/core/models/rule-campaign'
import { CATALOGUE } from '../../../../tools/campaigns-fixtures.mjs'
import { newBlock, newRule, paletteFor } from './palette'

const types = (kind: 'condition' | 'effect', features: RuleCampaignFeatures) =>
  paletteFor(CATALOGUE, kind, features).groups.flatMap((g) => g.blocks.map((b) => b.type))
const block = (type: string) => CATALOGUE.blocks.find((b) => b.type === type)!

describe('palette', () => {
  it('palette_gatesPointsAndCouponBlocks_byFeature_andHidesNotDecided', () => {
    const none = { coupons: false, points: false }
    const both = { coupons: true, points: true }
    expect(types('condition', none)).not.toContain('coupon')
    expect(types('condition', none)).not.toContain('minPoints')
    expect(types('effect', none)).not.toContain('awardPoints')
    expect(types('effect', none)).not.toContain('burnPoints')
    expect(types('condition', { coupons: true, points: false })).toContain('coupon')
    expect(types('condition', { coupons: true, points: false })).not.toContain('minPoints')
    expect(types('condition', both)).toEqual(expect.arrayContaining(['coupon', 'minPoints']))
    expect(types('effect', both)).toEqual(expect.arrayContaining(['awardPoints', 'burnPoints']))

    // Not decided on the map: left out whatever the features say.
    for (const f of [none, both]) {
      expect(types('condition', f)).not.toContain('anniversary')
      expect(types('condition', f)).not.toContain('audience')
    }
    // Every block offered is decided and of the asked kind.
    const all = paletteFor(CATALOGUE, 'condition', both).groups.flatMap((g) => g.blocks)
    expect(all.every((b) => b.decided && b.kind === 'condition')).toBe(true)
  })

  it('says which features are off and would add blocks', () => {
    expect(paletteFor(CATALOGUE, 'condition', { coupons: false, points: false }).hiddenFeatures.sort()).toEqual(['coupons', 'points'])
    expect(paletteFor(CATALOGUE, 'effect', { coupons: false, points: false }).hiddenFeatures).toEqual(['points'])
    expect(paletteFor(CATALOGUE, 'effect', { coupons: false, points: true }).hiddenFeatures).toEqual([])
  })

  it('keeps the catalogue group order, only the kind groups, and drops an empty group', () => {
    expect(paletteFor(CATALOGUE, 'condition', { coupons: false, points: false }).groups.map((g) => g.key)).toEqual([
      'basket',
      'attribute',
      'loyalty',
      'sale',
      'logic',
    ])
    expect(paletteFor(CATALOGUE, 'effect', { coupons: false, points: false }).groups.map((g) => g.key)).toEqual(['discounts', 'couponsAndMessages'])
  })

  it('leaves out a formula block until the guided fx helper lands (507)', () => {
    expect(types('condition', { coupons: true, points: true })).not.toContain('expr')
  })

  it('a pick adds a block with every catalogue field, empty, and the new id', () => {
    const rule = { filters: [{ id: 'f-sun', name: 'sun', cats: [], colls: [], skus: [], exclCats: [], scope: 'items' }] }
    expect(newBlock(block('minSubtotal'), rule, 'c-new')).toEqual({ id: 'c-new', type: 'minSubtotal', of: '', amount: null, basis: 'total', says: { en: '', ar: '' } })
    expect(newBlock(block('discountItems'), rule, 'e-new')).toEqual({
      id: 'e-new',
      type: 'discountItems',
      kind: 'percent',
      value: null,
      per: 'unit',
      on: 'f-sun',
      label: { en: '', ar: '' },
    })
    expect(newBlock(block('discountSession'), rule, 'e2').scope).toBe('items')
    expect(newBlock(block('group'), rule, 'g1')).toMatchObject({ type: 'group', mode: 'all', items: [] })
    expect(newBlock(block('minCount'), { filters: [] }, 'c2').of).toBe('')
  })

  it('a new rule is empty and reads "always"', () => {
    expect(newRule('r9')).toEqual({ id: 'r9', name: '', filters: [], values: [], when: { mode: 'all', items: [] }, then: [], partial: 'refuse' })
  })
})
