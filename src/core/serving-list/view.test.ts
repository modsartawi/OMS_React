/**
 * Spec 3042 — a serving list's name in the UI language, its screen's path, and a callout's serving list as one
 * value (oms 567-572). Pure.
 */
import { describe, expect, it } from 'vitest'
import { servingListHref, servingListName, servingListView } from './view'

describe('servingListName', () => {
  const both = { nameEn: 'Riyadh north', nameAr: 'شمال الرياض' }

  it('names the list in the UI language', () => {
    expect(servingListName(both, 'en')).toBe('Riyadh north')
    expect(servingListName(both, 'ar')).toBe('شمال الرياض')
    expect(servingListName(both, 'ar-SA')).toBe('شمال الرياض')
  })

  it("falls back to the other language's name when that one is blank, either way", () => {
    expect(servingListName({ nameEn: '', nameAr: 'شمال الرياض' }, 'en')).toBe('شمال الرياض')
    expect(servingListName({ nameEn: 'Riyadh north', nameAr: '  ' }, 'ar')).toBe('Riyadh north')
  })

  it('trims, and is blank when both are', () => {
    expect(servingListName({ nameEn: '  Riyadh north ', nameAr: '' }, 'en')).toBe('Riyadh north')
    expect(servingListName({ nameEn: '', nameAr: '' }, 'en')).toBe('')
  })
})

describe('servingListHref', () => {
  it('goes to the serving list screen', () => {
    expect(servingListHref('SL 7')).toBe('/oms/serving-lists/SL%207')
  })
})

const drawn = { servingListId: 'SL7', servingListNameEn: 'Riyadh north', servingListNameAr: 'شمال الرياض' }

describe('servingListView', () => {
  it('names the list in the UI language', () => {
    expect(servingListView(drawn, 'en')).toEqual({ kind: 'list', id: 'SL7', label: 'Riyadh north', named: true })
    expect(servingListView(drawn, 'ar')).toEqual({ kind: 'list', id: 'SL7', label: 'شمال الرياض', named: true })
  })

  it('a gone list (names blank) shows its id alone', () => {
    expect(servingListView({ ...drawn, servingListNameEn: '', servingListNameAr: '' }, 'en')).toEqual({ kind: 'list', id: 'SL7', label: 'SL7', named: false })
    expect(servingListView({ ...drawn, servingListNameEn: '', servingListNameAr: '' }, 'ar')).toEqual({ kind: 'list', id: 'SL7', label: 'SL7', named: false })
  })

  it('a type with no list reads "none" (the dash)', () => {
    expect(servingListView({ ...drawn, servingListId: '', servingListNameEn: '', servingListNameAr: '' }, 'en')).toEqual({ kind: 'none' })
    expect(servingListView({ servingListId: '  ' }, 'en')).toEqual({ kind: 'none' })
  })

  it('an older payload without the fields reads "none"', () => {
    expect(servingListView({}, 'en')).toEqual({ kind: 'none' })
  })
})
