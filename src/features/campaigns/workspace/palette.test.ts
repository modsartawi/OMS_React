/**
 * Tickets 505 / 522 / 523 — the palette offers what HQ's catalogue lists for the campaign's features
 * (`Rules/Authoring/Catalogue { features }` leaves out a block of a feature the campaign lacks),
 * never a block HQ marks `open`, and a pick adds HQ's `example` as a schema-1 block (`check` /
 * `effect`, no id) with its ids put right for this rule.
 */
import { describe, expect, it } from 'vitest'
import type { RuleFeature } from '@/core/models/rule-campaign'
import { CATALOGUE, catalogueFor } from '../../../../tools/campaigns-fixtures.mjs'
import { newBlock, newRule, paletteFor } from './palette'

const types = (kind: 'condition' | 'effect', features: RuleFeature[]) =>
  paletteFor(catalogueFor(features), kind, CATALOGUE).groups.flatMap((g) => g.blocks.map((b) => b.type))
const block = (type: string) => [...CATALOGUE.conditions, ...CATALOGUE.effects].find((b) => b.type === type)!

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
    // HQ marks the audience block `open`: left out whatever the features say.
    for (const f of [[], ['coupons', 'points']] as RuleFeature[][]) expect(types('condition', f)).not.toContain('audience')
    const all = paletteFor(CATALOGUE, 'condition', CATALOGUE).groups.flatMap((g) => g.blocks)
    expect(all.every((b) => b.open === null && b.kind === 'condition')).toBe(true)
  })

  it('groups blocks by HQ’s palette groups, in HQ’s order, with only groups that have a block', () => {
    const groups = paletteFor(catalogueFor([]), 'condition', CATALOGUE).groups.map((g) => g.group.id)
    expect(groups).toEqual(['cart', 'customer', 'context', 'limits', 'advanced'])
    expect(paletteFor(catalogueFor([]), 'condition', CATALOGUE).groups[0].group.name).toEqual({ en: 'Cart', ar: 'السلة' })
  })

  it('says which features are off and would add blocks', () => {
    expect(paletteFor(catalogueFor([]), 'condition', CATALOGUE).hiddenFeatures.sort()).toEqual(['coupons', 'points'])
    expect(paletteFor(catalogueFor(['points']), 'effect', CATALOGUE).hiddenFeatures).toEqual(['coupons'])
    expect(paletteFor(CATALOGUE, 'effect', CATALOGUE).hiddenFeatures).toEqual([])
    // With no full catalogue to compare with, it says nothing rather than guess.
    expect(paletteFor(catalogueFor([]), 'effect').hiddenFeatures).toEqual([])
  })

  it('offers the formula condition, written with the guided fx helper (507)', () => {
    expect(types('condition', [])).toContain('formula')
  })

  it('a pick adds HQ’s example as a schema-1 block, its samples left out and its ids put right for this rule', () => {
    const rule = { filters: [{ id: 'f-sun', name: 'sun' }] }
    // A condition starts on all merchandise: the example's sample filter goes.
    expect(newBlock(block('minSubtotal'), rule)).toEqual({ check: 'minSubtotal', amount: 100, says: { en: 'not met yet', ar: 'لم يتحقق بعد' } })
    // An effect works on the rule's first filter.
    expect(newBlock(block('discountItems'), rule)).toEqual({ effect: 'discountItems', filter: 'f-sun', kind: 'percent', value: 10, label: { en: 'Offer', ar: 'عرض' } })
    expect(newBlock(block('freeUnits'), { filters: [] })).not.toHaveProperty('filter')
    // HQ's sample identifiers name nothing of this campaign: a budget, a code, codes are left to pick.
    expect(newBlock(block('budgetLeft'), rule)).not.toHaveProperty('budget')
    expect(newBlock(block('store'), rule)).toEqual({ check: 'store', in: [], says: { en: 'not met yet', ar: 'لم يتحقق بعد' } })
    expect(newBlock(block('coupon'), rule)).not.toHaveProperty('code')
    // …while its figures, choices and yes / no are the defaults.
    expect(newBlock(block('awardPoints'), rule)).toEqual({ effect: 'awardPoints', amount: 500, unit: 'PTS' })
    expect(newBlock(block('group'), rule)).toEqual({ check: 'group', mode: 'any', conditions: [] })
    // The example is copied: editing a new block never edits the catalogue.
    const made = newBlock(block('tier'), rule) as unknown as { in: string[] }
    made.in.push('S')
    expect(block('tier').example).toEqual({ check: 'tier', in: ['G', 'P'], says: { en: 'not met yet', ar: 'لم يتحقق بعد' } })
  })

  it('a new rule is empty and reads "always"', () => {
    expect(newRule('r9')).toEqual({ id: 'r9', name: '', filters: [], values: [], when: [], then: [] })
  })
})
