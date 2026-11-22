/**
 * oms 952 (BackOffice spec 4182 §D): the page drawer shows the current route's article in the help language, on that
 * language's side, with "Open full article".
 */
import { createElement } from 'react'
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { helpArticleQuery, helpContentsQuery } from '@/core/help/help-api'
import type { HelpArticle, HelpContents, HelpLang } from '@/core/models/help'
import { HelpDrawerSheet } from './HelpDrawer'
import { drawHelp } from './test-render'

const meta = (slug: string, title: string, screens: string[]) => ({ slug, title, order: 0, access: ['viewer' as const], screens, questions: [], checkedAgainst: '' })

function seeded(lang: HelpLang, titles: { start: string; boards: string }): QueryClient {
  const client = new QueryClient()
  const contents: HelpContents = { draft: false, tours: [], articles: [meta('start', titles.start, ['/analytics']), meta('boards', titles.boards, ['/analytics/board/:id'])] }
  client.setQueryData(helpContentsQuery('analytics', lang).queryKey, contents)
  for (const a of contents.articles) {
    const article: HelpArticle = { ...a, markdown: `# ${a.title}\n\nBody of ${a.slug}.`, sections: [] }
    client.setQueryData(helpArticleQuery('analytics', a.slug, lang).queryKey, article)
  }
  return client
}

const draw = (lang: HelpLang, pathname: string) =>
  drawHelp(
    createElement(HelpDrawerSheet, { area: 'analytics', pathname, lang, onClose: () => {} }),
    seeded(lang, lang === 'ar' ? { start: 'ابدأ هنا', boards: 'اللوحات' } : { start: 'Start here', boards: 'Boards' }),
  )

describe('the page help drawer', () => {
  it('opens on the right in English with the route article and "Open full article"', () => {
    const html = draw('en', '/analytics/board/42')
    expect(html).toMatch(/<dialog[^>]*dir="ltr"/)
    expect(html).toContain('data-help-drawer-side="right"')
    expect(html).toContain('data-help-drawer-article="boards"')
    expect(html).toContain('Body of boards.')
    expect(html).toContain('href="/analytics/help/boards"')
    expect(html).toContain('Open full article')
  })

  it('opens on the left in Arabic, in Arabic', () => {
    const html = draw('ar', '/analytics/board/42')
    expect(html).toMatch(/<dialog[^>]*dir="rtl"/)
    expect(html).toContain('data-help-drawer-side="left"')
    expect(html).toContain('اللوحات')
    expect(html).toContain('فتح المقالة كاملة')
  })

  it('falls back to start for a page no article covers', () => {
    const html = draw('en', '/analytics/price-command-center')
    expect(html).toContain('data-help-drawer-article="start"')
    expect(html).toContain('href="/analytics/help/start"')
  })
})
