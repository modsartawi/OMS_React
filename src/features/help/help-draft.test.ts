/** oms 951 (BackOffice spec 4182 §B "the draft flag"): the Draft banner shows while the area is draft, and only then. */
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import HelpDraftBanner from './HelpDraftBanner'
import { drawHelp } from './test-render'

const draw = (draft: boolean, lang: 'en' | 'ar' = 'en') => drawHelp(createElement(HelpDraftBanner, { draft, lang }))

describe('HelpDraftBanner', () => {
  it('shows while the area is draft, in the help language', () => {
    expect(draw(true)).toMatch(/data-help-draft[\s\S]*Draft[\s\S]*still being checked/)
    expect(draw(true, 'ar')).toContain('مسودة')
  })

  it('draws nothing once the area is published', () => {
    expect(draw(false)).toBe('')
  })
})
