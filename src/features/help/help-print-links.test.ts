/**
 * oms 953 (BackOffice spec 4182 §D): on paper a link cannot be clicked, so an article's links print as text — a
 * `screen:` link as the screen's name, a `help:` link as its own words with the article's title after them in brackets
 * ("See [reading a board](help:boards#panel)" → "See reading a board (Boards)") — in the print language. The sentence
 * already carries its "see"; the print adding one more read "See see Boards" (owner's PDF, 2026-11-23).
 */
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import HelpMarkdown from './HelpMarkdown'
import { drawHelp } from './test-render'

const titles = { boards: 'Boards', reports: 'التقارير' }
const draw = (markdown: string, lang: 'en' | 'ar' = 'en') => drawHelp(createElement(HelpMarkdown, { area: 'analytics', markdown, lang, print: { titles } }))
/** The printed words, with every tag but the title's `<bdi>` dropped. */
const words = (html: string) => html.replace(/<(?!\/?bdi\b)[^>]*>/g, '')

describe('HelpMarkdown on paper', () => {
  it('a screen: link prints as the screen name, not a button or a link', () => {
    const html = draw('Open [My boards](screen:/analytics/boards) to start.')
    expect(html).toContain('My boards')
    expect(html).not.toMatch(/<button/)
    expect(html).not.toMatch(/<a /)
    expect(html).not.toContain('Open this screen')
  })

  it('a help: link prints its words, then the article title in brackets — never a second "see"', () => {
    const en = draw('See [reading a board](help:boards#panel).')
    expect(words(en)).toMatch(/See reading a board \(<bdi>Boards<\/bdi>\)\./)
    expect(words(en)).not.toMatch(/see see/i)
    expect(en).not.toMatch(/<a /)
    expect(words(draw('انظر [مشاركة لوحة](help:reports).', 'ar'))).toMatch(/انظر مشاركة لوحة \(<bdi>التقارير<\/bdi>\)/)
  })

  it('a help: link whose words already are the article title prints them once', () => {
    expect(words(draw('Read [Boards](help:boards).'))).toMatch(/Read Boards\./)
  })

  it('a help: link to an article the contents does not list prints its own words', () => {
    expect(words(draw('Read [the old page](help:gone).'))).toMatch(/Read the old page\./)
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
