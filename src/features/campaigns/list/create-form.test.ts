import { describe, expect, it } from 'vitest'
import { EMPTY_CREATE_FORM, createFormProblems, toCreateBody } from './create-form'

describe('createForm', () => {
  it('createForm_requiresBothNames', () => {
    expect(createFormProblems(EMPTY_CREATE_FORM)).toEqual(['nameEnRequired', 'nameArRequired'])
    expect(createFormProblems({ ...EMPTY_CREATE_FORM, nameEn: 'National Day 15% off' })).toEqual(['nameArRequired'])
    expect(createFormProblems({ ...EMPTY_CREATE_FORM, nameAr: 'خصم اليوم الوطني' })).toEqual(['nameEnRequired'])
    expect(createFormProblems({ ...EMPTY_CREATE_FORM, nameEn: 'National Day 15% off', nameAr: 'خصم اليوم الوطني' })).toEqual([])
  })

  it('a name of only spaces is no name', () => {
    expect(createFormProblems({ ...EMPTY_CREATE_FORM, nameEn: '   ', nameAr: '\t' })).toEqual(['nameEnRequired', 'nameArRequired'])
  })

  it('starts with points on and coupons off, as the prototype does', () => {
    expect(EMPTY_CREATE_FORM).toMatchObject({ coupons: false, points: true })
  })

  it('sends both names trimmed and the features as chosen', () => {
    expect(toCreateBody({ nameEn: ' Suncare ', nameAr: ' العناية بالشمس ', coupons: true, points: false })).toEqual({
      name: { en: 'Suncare', ar: 'العناية بالشمس' },
      features: { coupons: true, points: false },
    })
  })
})
