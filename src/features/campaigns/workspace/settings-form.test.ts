import { describe, expect, it } from 'vitest'
import type { CampaignRule, RuleCondition, RuleDraft, RuleEvaluationTree } from '@/core/models/rule-campaign'
import { CAMPAIGNS, CATALOGUE } from '../../../../tools/campaigns-fixtures.mjs'
import { detailsProblems, draftAfterReread, draftSave, draftStateInput, featuresInUse, toDetailsName } from './settings-form'

const byCode = (code: string): RuleDraft => CAMPAIGNS.find((c) => c.code === code)!

describe('featuresInUse', () => {
  it('featureOff_refusedWhileBlocksUseIt_namingTheRules', () => {
    const c = byCode('PTS-50OFF')
    // minPoints (a condition) and burnPoints (an effect) both need points: the rule is named once.
    expect(featuresInUse(c.features, [], c.campaign.rules, CATALOGUE)).toEqual([
      { feature: 'points', rules: [{ id: c.campaign.rules[0].id, name: c.campaign.rules[0].name }] },
    ])
    const w = byCode('WKND20')
    expect(featuresInUse(w.features, ['points'], w.campaign.rules, CATALOGUE)).toEqual([
      { feature: 'coupons', rules: [{ id: w.campaign.rules[0].id, name: w.campaign.rules[0].name }] },
    ])
  })

  it('lets a feature go that no block uses, and never refuses switching one on', () => {
    const d = byCode('SPRING-DRAFT')
    expect(featuresInUse([], ['coupons', 'points'], d.campaign.rules, CATALOGUE)).toEqual([])
    expect(featuresInUse(['coupons', 'points'], [], [], CATALOGUE)).toEqual([])
  })

  it('finds a block inside a group, and names every rule that uses it, in rule order', () => {
    const minPoints: RuleCondition = { check: 'minPoints', says: { en: '', ar: '' }, points: 10 }
    const group: RuleCondition = { check: 'group', mode: 'any', conditions: [minPoints] }
    const rule = (id: string, name: string, when: RuleCondition[]): CampaignRule => ({ id, name, filters: [], values: [], when, then: [] })
    const rules = [rule('r1', 'First', [group]), rule('r2', 'Second', []), rule('r3', '', [minPoints])]
    expect(featuresInUse(['points'], [], rules, CATALOGUE)).toEqual([
      { feature: 'points', rules: [{ id: 'r1', name: 'First' }, { id: 'r3', name: '' }] },
    ])
  })
})

describe('draftSave_sendsTheWholeDraftAtItsRevision', () => {
  it('puts the page part into the loaded campaign and keeps the rest, the features and the revision', () => {
    const d = { ...byCode('GP-BEAUTY15'), revision: 4 }
    const body = draftSave(d, { onlineOnly: true })
    expect(body.revision).toBe(4)
    expect(body.features).toEqual(d.features)
    expect(body.campaign).toEqual({ ...d.campaign, onlineOnly: true })
    expect(body).not.toHaveProperty('tree')
  })

  it('keeps the draft’s own evaluation tree: the save is the draft’s whole state (absent = the live order)', () => {
    const tree: RuleEvaluationTree = { groups: [{ id: 'g1', name: { en: 'Deals', ar: 'عروض' }, mode: 'highest', scope: 'item', campaigns: ['WKND20'] }], order: [{ group: 'g1' }] }
    const d = { ...byCode('WKND20'), tree }
    expect(draftSave(d, {}).tree).toEqual(tree)
  })

  it('the Features page sends its own list', () => {
    expect(draftSave(byCode('WKND20'), {}, ['points']).features).toEqual(['points'])
  })
})

describe('draftStateInput', () => {
  it('reads a draft state only when Load answered a draft', () => {
    const live = byCode('GP-BEAUTY15')
    expect(draftStateInput({ ...live, source: 'published', state: 'editing' }).state).toBeNull()
    expect(draftStateInput({ ...live, source: 'draft', state: 'pending' }).state).toBe('pending')
  })
})

describe('details', () => {
  it('needs both names; a name of only spaces is no name', () => {
    expect(detailsProblems({ nameEn: 'Spring', nameAr: 'ربيع' })).toEqual([])
    expect(detailsProblems({ nameEn: '  ', nameAr: '' })).toEqual(['nameEnRequired', 'nameArRequired'])
  })

  it('sends the names trimmed', () => {
    expect(toDetailsName({ nameEn: ' Spring ', nameAr: ' ربيع ' })).toEqual({ en: 'Spring', ar: 'ربيع' })
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
