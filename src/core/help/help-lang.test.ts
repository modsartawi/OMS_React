/** oms 951 (decision 2): the help reads Arabic when the app's language is Arabic or the page boots right-to-left. */
import { describe, expect, it } from 'vitest'
import { helpDir, helpLangOf } from './help-lang'

describe('helpLangOf', () => {
  it('is Arabic for an Arabic i18next language, or a right-to-left page; English otherwise', () => {
    expect(helpLangOf('ar', 'ltr')).toBe('ar')
    expect(helpLangOf('ar-SA', 'ltr')).toBe('ar')
    expect(helpLangOf('en', 'rtl')).toBe('ar')
    expect(helpLangOf('en', 'ltr')).toBe('en')
    expect(helpLangOf(undefined, 'ltr')).toBe('en')
    expect([helpDir('ar'), helpDir('en')]).toEqual(['rtl', 'ltr'])
  })
})
