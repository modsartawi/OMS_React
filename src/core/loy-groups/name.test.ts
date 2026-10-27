/**
 * A loyalty group's display name (oms ticket 629; brief rule "Arabic names are shown as stored").
 */
import { describe, expect, it } from 'vitest'
import { loyGroupName } from './api'

describe('group display name follows the locale and falls back to the other name', () => {
  const g = { nameEn: 'Ramadan VIP 2', nameAr: 'كبار رمضان ٢' }

  it('reads the English name under English', () => {
    expect(loyGroupName(g, 'en')).toBe('Ramadan VIP 2')
  })

  it('reads the Arabic name under Arabic, as stored — Arabic-Indic digits and spacing untouched', () => {
    expect(loyGroupName(g, 'ar')).toBe('كبار رمضان ٢')
    expect(loyGroupName({ nameEn: 'X', nameAr: ' فئة ١٠ ' }, 'ar')).toBe(' فئة ١٠ ')
  })

  it('falls back to the other name when the locale one is blank', () => {
    expect(loyGroupName({ nameEn: 'Staff', nameAr: '' }, 'ar')).toBe('Staff')
    expect(loyGroupName({ nameEn: 'Staff', nameAr: '   ' }, 'ar')).toBe('Staff')
    expect(loyGroupName({ nameEn: '', nameAr: 'الموظفون' }, 'en')).toBe('الموظفون')
  })

  it('is empty when both names are blank', () => {
    expect(loyGroupName({ nameEn: ' ', nameAr: '' }, 'ar')).toBe('')
  })
})
