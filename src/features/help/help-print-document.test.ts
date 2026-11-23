/**
 * oms 953 (BackOffice spec 4182 §D): the printed help — a cover (title, language, "checked against", print date, a
 * Draft watermark while the area is draft), the contents (each article with its access badge and page number), then
 * every article in reading order, each in its own page block, in one language and its direction.
 */
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import type { HelpArticle, HelpContents } from '@/core/models/help'
import HelpPrintDocument from './HelpPrintDocument'
import { drawHelp } from './test-render'

const meta = (slug: string, title: string, order: number, access: HelpArticle['access'] = ['viewer']) => ({
  slug,
  title,
  order,
  access,
  screens: [],
  questions: [],
  checkedAgainst: 'oms 9f07388 · SIS.Api 4.12 · image 1.3',
})
const contents = (draft: boolean): HelpContents => ({
  draft,
  // Sent out of order on purpose: the paper reads by `order`.
  tours: [],
  articles: [meta('whats-new', "What's new", 99), meta('start', 'Start here', 0), meta('reports', 'Reports', 30, ['viewer', 'author'])],
})
const articles: HelpArticle[] = [
  { ...meta('whats-new', "What's new", 99), markdown: '## Lately\n\nNew things.', sections: [] },
  { ...meta('start', 'Start here', 0), markdown: '## Welcome\n\nSee [reports](help:reports).', sections: [] },
  { ...meta('reports', 'Reports', 30, ['viewer', 'author']), markdown: '## Build one\n\nOpen [Reports](screen:/analytics/reports).', sections: [] },
]

const draw = (draft: boolean, lang: 'en' | 'ar' = 'en', pageNumbers: number[] | null = [3, 4, 6]) =>
  drawHelp(createElement(HelpPrintDocument, { area: 'analytics', lang, contents: contents(draft), articles, pageNumbers, printedOn: '2026-11-22' }))

const order = (html: string, attr: string) => [...html.matchAll(new RegExp(`${attr}="([^"]+)"`, 'g'))].map((m) => m[1])

describe('HelpPrintDocument', () => {
  it('prints every article of the contents in reading order, each in its own page block', () => {
    const html = draw(false)
    expect(order(html, 'data-help-print-article')).toEqual(['start', 'reports', 'whats-new'])
    const blocks = [...html.matchAll(/<section[^>]*data-help-print-article="[^"]+"[^>]*>/g)].map((m) => m[0])
    expect(blocks).toHaveLength(3)
    for (const block of blocks) expect(block).toContain('[break-before:page]')
    expect(html).toMatch(/data-help-print-article="start"[\s\S]*Welcome[\s\S]*data-help-print-article="reports"[\s\S]*Build one/)
  })

  it('lists the contents in the same order with each access badge and page number', () => {
    const html = draw(false)
    expect(order(html, 'data-help-print-entry')).toEqual(['start', 'reports', 'whats-new'])
    expect(html).toMatch(/data-help-print-entry="reports"[\s\S]*?data-help-access="viewer"[\s\S]*?data-help-access="author"[\s\S]*?<bdi dir="ltr">4<\/bdi>/)
    expect(html).toMatch(/data-help-print-entry="whats-new"[\s\S]*?<bdi dir="ltr">6<\/bdi>/)
  })

  it('prints no page number in the contents before the pages are laid out', () => {
    expect(draw(false, 'en', null)).not.toMatch(/data-help-print-page=/)
  })

  it('the cover has the title, the language, the checked-against line and the print date', () => {
    const html = draw(false)
    expect(html).toContain('Analytics: user guide')
    expect(html).toMatch(/data-help-print-language[^>]*>[\s\S]*English/)
    expect(html).toMatch(/data-help-print-checked[\s\S]*oms 9f07388 · SIS.Api 4.12 · image 1.3/)
    expect(html).toMatch(/data-help-print-date[\s\S]*2026/)
  })

  it('the Draft watermark shows only while the area is draft', () => {
    expect(draw(true)).toMatch(/data-help-print-draft[^>]*>[\s\S]*Draft/)
    expect(draw(false)).not.toContain('data-help-print-draft')
  })

  it('Arabic prints right to left, in Arabic, links as text', () => {
    const html = draw(true, 'ar')
    expect(html).toMatch(/^<div[^>]*dir="rtl"[^>]*lang="ar"/)
    expect(html).toContain('دليل المستخدم')
    expect(html).toContain('مسودة')
    expect(html).not.toMatch(/<a |<button/)
  })

  it('links print as text: a help link as its own words (here they already are the title, so no brackets), a screen link as its name', () => {
    const html = draw(false)
    expect(html).toMatch(/See <span data-help-print-link="reports">reports<\/span>\./)
    expect(html).not.toMatch(/see see/i)
    expect(html).not.toMatch(/<a |<button/)
  })
})
