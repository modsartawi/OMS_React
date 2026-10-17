import { describe, expect, it } from 'vitest'
import type { CampaignRule, RuleCampaign, RuleCondition } from '@/core/models/rule-campaign'
import { CAMPAIGNS, CATALOGUE } from '../../../../tools/campaigns-fixtures.mjs'
import { detailsProblems, draftAfterReread, featuresInUse, toDetailsBody } from './settings-form'

const byId = (id: string): RuleCampaign => CAMPAIGNS.find((c) => c.id === id)!

describe('featuresInUse', () => {
  it('featureOff_refusedWhileBlocksUseIt_namingTheRules', () => {
    const c = byId('PTS-50OFF')
    // minPoints (a condition) and burnPoints (an effect) both need points: the rule is named once.
    expect(featuresInUse(c.features, { coupons: false, points: false }, c.rules, CATALOGUE)).toEqual([
      { feature: 'points', rules: [{ id: c.rules[0].id, name: 'Burn 30, take 50 off, together or not at all' }] },
    ])
    const w = byId('WKND20')
    expect(featuresInUse(w.features, { coupons: false, points: true }, w.rules, CATALOGUE)).toEqual([
      { feature: 'coupons', rules: [{ id: w.rules[0].id, name: '20% off the basket, Rx excluded' }] },
    ])
  })

  it('lets a feature go that no block uses, and never refuses switching one on', () => {
    const w = byId('WKND20')
    expect(featuresInUse(w.features, { coupons: true, points: false }, w.rules, CATALOGUE)).toEqual([])
    const d = byId('SPRING-DRAFT')
    expect(featuresInUse({ coupons: false, points: false }, { coupons: true, points: true }, d.rules, CATALOGUE)).toEqual([])
  })

  it('finds a block inside a group, and names every rule that uses it, in rule order', () => {
    const minPoints: RuleCondition = { id: 'c-in', type: 'minPoints', says: { en: '', ar: '' }, amount: 10, unit: 'PTS' }
    const group: RuleCondition = { id: 'g1', type: 'group', says: { en: '', ar: '' }, mode: 'any', items: [minPoints] }
    const rule = (id: string, name: string, items: RuleCondition[]): CampaignRule => ({
      id, name, filters: [], values: [], when: { mode: 'all', items }, then: [], partial: 'refuse',
    })
    const rules = [rule('r1', 'First', [group]), rule('r2', 'Second', []), rule('r3', '', [minPoints])]
    expect(featuresInUse({ coupons: false, points: true }, { coupons: false, points: false }, rules, CATALOGUE)).toEqual([
      { feature: 'points', rules: [{ id: 'r1', name: 'First' }, { id: 'r3', name: '' }] },
    ])
  })
})

describe('details', () => {
  it('needs both names; a name of only spaces is no name', () => {
    expect(detailsProblems({ nameEn: 'Spring', nameAr: 'ربيع', description: '' })).toEqual([])
    expect(detailsProblems({ nameEn: '  ', nameAr: '' , description: 'x'})).toEqual(['nameEnRequired', 'nameArRequired'])
  })

  it('sends the names and the description trimmed', () => {
    expect(toDetailsBody({ nameEn: ' Spring ', nameAr: ' ربيع ', description: ' A note \n' })).toEqual({
      name: { en: 'Spring', ar: 'ربيع' },
      description: 'A note',
    })
  })
})

describe('draftAfterReread', () => {
  const was = JSON.stringify({ stores: ['R101'] })
  const fresh = { stores: ['J204'] }

  it('takes HQ’s new value when the draft had no unsaved change', () => {
    expect(draftAfterReread({ stores: ['R101'] }, was, fresh, false)).toBe(fresh)
  })

  it('keeps the marketer’s unsaved draft through a background re-read', () => {
    const typed = { stores: ['R101', 'M01'] }
    expect(draftAfterReread(typed, was, fresh, false)).toBe(typed)
  })

  it('takes HQ’s answer to the page’s own Save, as HQ saved it (trimmed)', () => {
    const typed = { name: ' Spring ' }
    const answer = { name: 'Spring' }
    expect(draftAfterReread(typed, JSON.stringify({ name: 'Old' }), answer, true)).toBe(answer)
  })
})
