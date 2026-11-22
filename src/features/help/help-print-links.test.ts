/**
 * oms 953 (BackOffice spec 4182 §D): on paper a link cannot be clicked, so an article's links print as text — a
 * `screen:` link as the screen's name, a `help:` link as "see <article title>" — in the print language.
 */
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import HelpMarkdown from './HelpMarkdown'
import { drawHelp } from './test-render'

const titles = { boards: 'Boards', reports: 'التقارير' }
const draw = (markdown: string, lang: 'en' | 'ar' = 'en') => drawHelp(createElement(HelpMarkdown, { area: 'analytics', markdown, lang, print: { titles } }))

describe('HelpMarkdown on paper', () => {
  it('a screen: link prints as the screen name, not a button or a link', () => {
    const html = draw('Open [My boards](screen:/analytics/boards) to start.')
    expect(html).toContain('My boards')
    expect(html).not.toMatch(/<button/)
    expect(html).not.toMatch(/<a /)
    expect(html).not.toContain('Open this screen')
  })

  it('a help: link prints as "see" and the article title, in the print language', () => {
    const en = draw('Read [how to share](help:boards#share).')
    expect(en).toMatch(/see <bdi>Boards<\/bdi>/)
    expect(en).not.toMatch(/<a /)
    expect(draw('اقرأ [التقارير](help:reports).', 'ar')).toMatch(/انظر <bdi>التقارير<\/bdi>/)
  })

  it('a help: link to an article the contents does not list prints its own words', () => {
    const html = draw('Read [the old page](help:gone).')
    expect(html).toMatch(/see <bdi>the old page<\/bdi>/)
  })

  it('a heading link and an outside link print their words only', () => {
    const html = draw('Jump [below](#more) or visit [the site](https://example.com).')
    expect(html).toContain('below')
    expect(html).toContain('the site')
    expect(html).not.toMatch(/<a /)
  })

  it('on screen, links stay links (the help center is unchanged)', () => {
    const html = drawHelp(createElement(HelpMarkdown, { area: 'analytics', markdown: '[x](help:boards)', lang: 'en' }))
    expect(html).toMatch(/<a[^>]*href="\/analytics\/help\/boards"/)
  })
})
