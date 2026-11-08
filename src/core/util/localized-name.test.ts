/**
 * A bilingual record's name in the UI language (3461 review F) — the one rule behind serving lists,
 * loyalty groups and cancellation reasons.
 */
import { describe, expect, it } from 'vitest'
import { localizedName } from './localized-name'

describe('localizedName', () => {
  const both = { nameEn: 'Riyadh north', nameAr: 'شمال الرياض' }

  it('reads Arabic under any ar* language and English otherwise', () => {
    expect(localizedName(both, 'ar')).toBe('شمال الرياض')
    expect(localizedName(both, 'ar-SA')).toBe('شمال الرياض')
    expect(localizedName(both, 'en')).toBe('Riyadh north')
    expect(localizedName(both, '')).toBe('Riyadh north')
  })

  it('falls back to the other name when the language one is blank, absent or whitespace', () => {
    expect(localizedName({ nameEn: 'Staff', nameAr: '   ' }, 'ar')).toBe('Staff')
    expect(localizedName({ nameEn: 'Staff', nameAr: null }, 'ar')).toBe('Staff')
    expect(localizedName({ nameEn: undefined, nameAr: 'الموظفون' }, 'en')).toBe('الموظفون')
  })

  it('returns the picked name as stored — trimming is the caller’s choice', () => {
    expect(localizedName({ nameEn: 'X', nameAr: ' فئة ١٠ ' }, 'ar')).toBe(' فئة ١٠ ')
  })

  it('is empty when both names are blank', () => {
    expect(localizedName({ nameEn: ' ', nameAr: '' }, 'ar')).toBe('')
    expect(localizedName({}, 'en')).toBe('')
  })
})
