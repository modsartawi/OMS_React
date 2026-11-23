/**
 * One real article, end to end: BackOffice's `Help/analytics/{en,ar}/99-whats-new.md` (pricing2 @ 98f9a5ad9), copied
 * as it is into `./fixtures`, served the way `GET Help/analytics/whats-new` sends it — the front matter nested under
 * `article`, the body after it, the section outline — and read and drawn by the client.
 *
 * The expected values are read off the file by eye (its `{#anchor}`s, its `help:` links), not worked out by the code.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { permissionsOf } from '@/core/permissions'
import { articleForRoute } from '@/core/help/article-for-route'
import { helpArticleOf, helpContentsOf } from '@/core/help/help-api'
import type { HelpArticleReply, HelpContentsReply, HelpLang } from '@/core/models/help'
import HelpContentsRail from './HelpContentsRail'
import HelpMarkdown from './HelpMarkdown'
import { headingAnchors } from './help-anchors'
import { drawHelp } from './test-render'

const here = path.dirname(fileURLToPath(import.meta.url))

/** The file's body after its front matter, line endings as the server reads them (`\r\n` → `\n`). */
function bodyOf(lang: HelpLang): string {
  const lines = readFileSync(path.join(here, 'fixtures', `99-whats-new.${lang}.md`), 'utf8').replace(/\r\n/g, '\n').split('\n')
  const close = lines.indexOf('---', 1)
  return lines.slice(close + 1).join('\n').replace(/^\n+|\n+$/g, '')
}

// The front matter, as `HelpArticleInfo` serialises it (camelCase).
const INFO = {
  en: { slug: 'whats-new', title: "What's new", questions: ['What changed in the Analytics help?', 'When was the help last updated?'] },
  ar: { slug: 'whats-new', title: 'ما الجديد', questions: ['ما الذي تغيّر في مساعدة التحليلات؟', 'متى حُدّثت المساعدة آخر مرة؟'] },
}
const info = (lang: HelpLang) => ({ ...INFO[lang], order: 99, access: ['viewer'], screens: ['/analytics'], checkedAgainst: 'oms-react b4f6ba2a, SIS.Api 4e469c63e, analytics image 1.8.3' })

const SECTIONS = {
  en: [
    { anchor: '', heading: "What's new", level: 1 },
    { anchor: '2026-11-22-full', heading: '22 November 2026: the whole of Analytics is covered', level: 2 },
    { anchor: '2026-11-22', heading: '22 November 2026: the help is published', level: 2 },
  ],
  ar: [
    { anchor: '', heading: 'ما الجديد', level: 1 },
    { anchor: '2026-11-22-full', heading: '22 نوفمبر 2026: المساعدة تغطي التحليلات كلها', level: 2 },
    { anchor: '2026-11-22', heading: '22 نوفمبر 2026: نشر المساعدة', level: 2 },
  ],
}

const reply = (lang: HelpLang): HelpArticleReply =>
  ({ area: 'analytics', language: lang, draft: true, article: info(lang), markdown: bodyOf(lang), sections: SECTIONS[lang] }) as HelpArticleReply

describe('the real whats-new article', () => {
  it('reads flat: its front matter beside its body and sections', () => {
    const a = helpArticleOf(reply('en'))
    expect(a.slug).toBe('whats-new')
    expect(a.title).toBe("What's new")
    expect(a.access).toEqual(['viewer'])
    expect(a.markdown.startsWith('Every change to this help, newest first.')).toBe(true)
    expect(a.sections.map((s) => s.anchor)).toEqual(['', '2026-11-22-full', '2026-11-22'])
  })

  it.each(['en', 'ar'] as const)('%s: the client works out the same anchors the server sent', (lang) => {
    expect(headingAnchors(bodyOf(lang)).map((h) => h.anchor)).toEqual(['2026-11-22-full', '2026-11-22'])
  })

  it.each(['en', 'ar'] as const)('%s: draws its headings at their anchors, never showing {#…}, and its help links inside the help', (lang) => {
    const a = helpArticleOf(reply(lang))
    const html = drawHelp(createElement(HelpMarkdown, { area: 'analytics', markdown: a.markdown, sections: a.sections, lang }))
    expect(html).toMatch(/<h2[^>]*id="2026-11-22-full"/)
    expect(html).toMatch(/<h2[^>]*id="2026-11-22"/)
    expect(html).not.toContain('{#')
    expect(html).toContain('href="/analytics/help/schedules#no-charts"')
    expect(html).toContain('href="/analytics/help/copilot#schedule"')
    expect(html).not.toContain('href="help:')
  })

  it('its rail entry carries its one badge, and a viewer has it', () => {
    const contents = helpContentsOf({ area: 'analytics', language: 'en', draft: true, articles: [info('en')], tours: [] } as unknown as HelpContentsReply)
    const html = drawHelp(createElement(HelpContentsRail, { area: 'analytics', articles: contents.articles, activeSlug: null, permissions: permissionsOf({ screens: ['Analytics:03'] }), lang: 'en' }))
    expect([...html.matchAll(/data-help-access="([^"]+)"/g)].map((m) => m[1])).toEqual(['viewer'])
    expect(html).toContain('You have this access.')
  })
})

describe('each screen of the real front matter has one article (BackOffice 5b5cd5f52)', () => {
  // start and whats-new claim the help center; Home and the library's pages are home-library's; Shared and Certified
  // are sharing-certified's.
  const articles = helpContentsOf({
    articles: [
      { ...info('en'), slug: 'start', order: 0, screens: ['/analytics/help'] },
      { ...info('en'), slug: 'home-library', order: 1, screens: ['/analytics', '/analytics/library', '/analytics/deleted'] },
      { ...info('en'), slug: 'sharing-certified', order: 6, screens: ['/analytics/shared', '/analytics/certified'] },
      { ...info('en'), slug: 'reports', order: 4, screens: ['/analytics/report/:id', '/analytics/print/report/:id'] },
      { ...info('en'), slug: 'whats-new', order: 99, screens: ['/analytics/help'] },
      info('en'),
    ],
  } as unknown as HelpContentsReply).articles

  it('Home opens home-library, Shared opens sharing-certified, the help center opens start, a pattern matches its route', () => {
    expect(articleForRoute(articles, '/analytics')).toBe('home-library')
    expect(articleForRoute(articles, '/analytics/shared')).toBe('sharing-certified')
    expect(articleForRoute(articles, '/analytics/certified')).toBe('sharing-certified')
    expect(articleForRoute(articles, '/analytics/help')).toBe('start')
    expect(articleForRoute(articles, '/analytics/report/42')).toBe('reports')
  })

  it('if two articles ever claim one screen, the first in the contents (the server sends reading order) wins', () => {
    const overlap = helpContentsOf({
      articles: [
        { ...info('en'), slug: 'home-library', order: 1, screens: ['/analytics/shared'] },
        { ...info('en'), slug: 'sharing-certified', order: 6, screens: ['/analytics/shared'] },
      ],
    } as unknown as HelpContentsReply).articles
    expect(articleForRoute(overlap, '/analytics/shared')).toBe('home-library')
  })
})
