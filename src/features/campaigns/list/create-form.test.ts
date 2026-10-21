import { describe, expect, it } from 'vitest'
import { campaignIdProblem, copyIdOf, suggestCampaignId } from '@/core/rules/campaign-id'
import { EMPTY_CREATE_FORM, createFormProblems, formId, toCreateSave } from './create-form'

const named = { ...EMPTY_CREATE_FORM, nameEn: 'National Day 15% off', nameAr: 'خصم اليوم الوطني' }

describe('createForm', () => {
  it('createForm_requiresBothNames', () => {
    expect(createFormProblems(EMPTY_CREATE_FORM)).toEqual(['nameEnRequired', 'nameArRequired', 'idRequired'])
    expect(createFormProblems({ ...named, nameAr: '' })).toEqual(['nameArRequired'])
    expect(createFormProblems({ ...named, nameEn: '', idEdited: true, id: 'NATDAY' })).toEqual(['nameEnRequired'])
    expect(createFormProblems(named)).toEqual([])
  })

  it('a name of only spaces is no name', () => {
    expect(createFormProblems({ ...EMPTY_CREATE_FORM, nameEn: '   ', nameAr: '\t' })).toEqual(['nameEnRequired', 'nameArRequired', 'idRequired'])
  })

  it('starts with points on and coupons off, as the prototype does', () => {
    expect(EMPTY_CREATE_FORM).toMatchObject({ coupons: false, points: true })
  })

  it('sends the first save at revision 0, the picked id, both names trimmed, no rules and the features', () => {
    expect(toCreateSave({ ...EMPTY_CREATE_FORM, nameEn: ' Suncare ', nameAr: ' العناية بالشمس ', id: 'SUN-26', idEdited: true, coupons: true, points: false })).toEqual({
      campaign: { id: 'SUN-26', name: { en: 'Suncare', ar: 'العناية بالشمس' }, rules: [] },
      features: ['coupons'],
      revision: 0,
    })
  })
})

describe('campaignId_authorPicksIt', () => {
  it('is suggested from the English name until the author edits it', () => {
    expect(suggestCampaignId('National Day 15% off')).toBe('NATIONAL-DAY-15-OFF')
    expect(suggestCampaignId('  ')).toBe('')
    expect(suggestCampaignId('x'.repeat(60))).toHaveLength(40)
    expect(formId(named)).toBe('NATIONAL-DAY-15-OFF')
    expect(formId({ ...named, idEdited: true, id: ' natday.26 ' })).toBe('natday.26')
  })

  it('takes at most 40 of A-Z a-z 0-9 . _ - and refuses the static leaves, in any case', () => {
    expect(campaignIdProblem('WKND20')).toBeNull()
    expect(campaignIdProblem('a.b_c-D9')).toBeNull()
    expect(campaignIdProblem('')).toBe('idRequired')
    expect(campaignIdProblem('A'.repeat(41))).toBe('idTooLong')
    expect(campaignIdProblem('WEEKEND 20')).toBe('idCharacters')
    expect(campaignIdProblem('خصم')).toBe('idCharacters')
    for (const leaf of ['priority', 'Simulator', 'SESSIONS', 'coupon-finder', 'customers', 'Promotions', 'no-promotion']) expect(campaignIdProblem(leaf)).toBe('idReserved')
  })

  it('refuses an id a listed campaign already has: a first save at revision 0 would draft over it', () => {
    expect(campaignIdProblem('WKND20', ['WKND20', 'SUN-3FOR2'])).toBe('idTaken')
    expect(campaignIdProblem('wknd20', ['WKND20'])).toBe('idTaken')
    expect(campaignIdProblem('WKND21', ['WKND20'])).toBeNull()
    expect(createFormProblems({ ...EMPTY_CREATE_FORM, nameEn: 'Weekend 20', nameAr: 'ع', id: 'WKND20', idEdited: true }, ['WKND20'])).toEqual(['idTaken'])
  })

  it('a copy is offered the source id with -COPY, kept within 40', () => {
    expect(copyIdOf('WKND20')).toBe('WKND20-COPY')
    expect(copyIdOf('A'.repeat(40))).toHaveLength(40)
    expect(campaignIdProblem(copyIdOf('A'.repeat(40)))).toBeNull()
  })
})
