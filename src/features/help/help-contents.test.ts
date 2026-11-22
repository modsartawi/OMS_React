/**
 * oms 951 (BackOffice spec 4182 §D): the contents rail lists an area's articles in order, each with its access badge
 * (Viewer, Author, Curator, SQL) and the sentence for the reader — "You have this access" or "Ask your administrator
 * for … access" — from the existing Analytics predicates. Every article stays a link: the help is readable either way.
 */
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { permissionsFromQuery, permissionsOf } from '@/core/permissions'
import type { HelpArticleMeta, HelpContents } from '@/core/models/help'
import HelpContentsRail from './HelpContentsRail'
import { drawHelp } from './test-render'

const meta = (slug: string, title: string, order: number, access: HelpArticleMeta['access']): HelpArticleMeta => ({
  slug,
  title,
  order,
  access,
  screens: [],
  questions: [],
  checkedAgainst: '',
})

// Out of order on purpose: the rail sorts by `order`.
const contents: HelpContents = {
  draft: true,
  articles: [meta('whats-new', 'What’s new', 99, 'viewer'), meta('sql', 'SQL', 10, 'sql'), meta('start', 'Start here', 0, 'viewer'), meta('sharing-certified', 'Sharing', 6, 'curator'), meta('schedules', 'Schedules', 5, 'author')],
}

const draw = (screens: string[], lang: 'en' | 'ar' = 'en') =>
  drawHelp(createElement(HelpContentsRail, { area: 'analytics', articles: contents.articles, activeSlug: 'start', permissions: permissionsOf({ screens }), lang }))

/** Each entry's slug, badge and sentence, in the order drawn. */
const entries = (html: string) =>
  [...html.matchAll(/data-help-entry="([^"]+)"[\s\S]*?data-help-access="([^"]+)"[^>]*>(?:<[^>]+>)*([^<]+)<[\s\S]*?data-help-access-sentence[^>]*>([^<]+)</g)].map((m) => [m[1], m[2], m[3], m[4]])

describe('the contents rail', () => {
  it('lists the articles in order, each badged with its access and a link to it', () => {
    const html = draw(['Analytics:03'])
    expect(entries(html).map((e) => e[0])).toEqual(['start', 'schedules', 'sharing-certified', 'sql', 'whats-new'])
    expect(entries(html).map((e) => e[2])).toEqual(['Viewer', 'Author', 'Curator', 'SQL', 'Viewer'])
    expect(html).toContain('href="/analytics/help/schedules"')
    expect(html).toContain('href="/analytics/help/sql"')
    expect(html).toMatch(/aria-current="page"[^>]*href="\/analytics\/help\/start"|href="\/analytics\/help\/start"[^>]*aria-current="page"/)
  })

  it('a viewer has the viewer articles and is told whom to ask for the rest', () => {
    expect(entries(draw(['Analytics:03'])).map((e) => [e[0], e[3]])).toEqual([
      ['start', 'You have this access.'],
      ['schedules', 'Ask your administrator for Author access.'],
      ['sharing-certified', 'Ask your administrator for Curator access.'],
      ['sql', 'Ask your administrator for SQL access.'],
      ['whats-new', 'You have this access.'],
    ])
  })

  it('an author with SQL but not curate', () => {
    expect(entries(draw(['Analytics:03', 'Analytics:02', 'Analytics:07'])).map((e) => e[3])).toEqual([
      'You have this access.',
      'You have this access.',
      'Ask your administrator for Curator access.',
      'You have this access.',
      'You have this access.',
    ])
  })

  it('a curator holds curate; no Analytics grant at all still lists every article', () => {
    expect(entries(draw(['Analytics:03', 'Analytics:02', 'Analytics:06']))[2][3]).toBe('You have this access.')
    const none = entries(draw([]))
    expect(none).toHaveLength(5)
    expect(none[0][3]).toBe('Ask your administrator for Viewer access.')
  })

  it('reads in Arabic when the help language is Arabic', () => {
    const ar = entries(draw(['Analytics:03'], 'ar'))
    expect(ar[0].slice(2)).toEqual(['مشاهد', 'لديك هذه الصلاحية.'])
    expect(ar[1].slice(2)).toEqual(['مُنشئ', 'اطلب من مسؤول النظام صلاحية مُنشئ.'])
  })

  it('says nothing about access while the permissions answer is pending', () => {
    const html = drawHelp(
      createElement(HelpContentsRail, { area: 'analytics', articles: contents.articles, activeSlug: 'start', permissions: permissionsFromQuery({ isPending: true, isError: false, data: undefined }), lang: 'en' }),
    )
    expect(html).toContain('data-help-entry="start"')
    expect(html).not.toContain('data-help-access-sentence')
  })
})
