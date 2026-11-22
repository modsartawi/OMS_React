/**
 * oms 951 (BackOffice spec 4182 §B "search is client-side"): the box above the rail filters an area's articles by
 * title, front-matter questions and body, in the app's language. Arabic matching ignores diacritics and the alef and
 * taa marbuta variants.
 */
import { describe, expect, it } from 'vitest'
import type { HelpArticleMeta } from '@/core/models/help'
import { searchArticles } from './help-search'

const meta = (slug: string, title: string, questions: string[] = []): HelpArticleMeta => ({
  slug,
  title,
  order: 0,
  access: 'viewer',
  screens: [],
  questions,
  checkedAgainst: '',
})

const english = [
  meta('start', 'Start here', ['How do I get access?']),
  meta('boards', 'Boards', ['How do I share a board?']),
  meta('schedules', 'Schedules'),
]
const englishBodies = {
  start: 'Analytics shows the **sales** of your stores.',
  boards: 'Drag a panel to [arrange](screen:/analytics/boards) it.',
  schedules: 'A schedule emails a PDF every morning.',
}

const arabic = [
  meta('start', 'ابدأ هنا', ['كيف أحصل على الصلاحية؟']),
  meta('boards', 'اللوحات', ['كيف أُشارك لوحةً؟']),
  meta('schedules', 'الجداول'),
]
const arabicBodies = {
  start: 'تعرض التحليلات مبيعات صيدلياتك.',
  boards: 'اسحب الجزء لترتيبه.',
  schedules: 'يُرسل الجدول تقريرًا كل صباح إلى مكتبة الإدارة.',
}

const slugs = (found: HelpArticleMeta[]) => found.map((a) => a.slug)

describe('searchArticles', () => {
  it('an empty query keeps every article, in order', () => {
    expect(slugs(searchArticles(english, englishBodies, '   '))).toEqual(['start', 'boards', 'schedules'])
  })

  it('finds an English article by its title, a question or its body, case aside', () => {
    expect(slugs(searchArticles(english, englishBodies, 'BOARDS'))).toEqual(['boards'])
    expect(slugs(searchArticles(english, englishBodies, 'access'))).toEqual(['start'])
    expect(slugs(searchArticles(english, englishBodies, 'pdf'))).toEqual(['schedules'])
    expect(slugs(searchArticles(english, englishBodies, 'sales'))).toEqual(['start'])
  })

  it('every word must match, and a link target or Markdown mark is not body text', () => {
    expect(slugs(searchArticles(english, englishBodies, 'share board'))).toEqual(['boards'])
    expect(slugs(searchArticles(english, englishBodies, 'share pdf'))).toEqual([])
    expect(slugs(searchArticles(english, englishBodies, 'screen'))).toEqual([])
    expect(slugs(searchArticles(english, englishBodies, '**'))).toEqual([])
  })

  it('a body not fetched yet still searches by title and questions', () => {
    expect(slugs(searchArticles(english, {}, 'share'))).toEqual(['boards'])
    expect(slugs(searchArticles(english, {}, 'pdf'))).toEqual([])
  })

  it('finds an Arabic article by title, question and body, with or without diacritics', () => {
    expect(slugs(searchArticles(arabic, arabicBodies, 'اللوحات'))).toEqual(['boards'])
    // The question is written أُشارك لوحةً — typed bare, it still matches.
    expect(slugs(searchArticles(arabic, arabicBodies, 'اشارك لوحة'))).toEqual(['boards'])
    // Typed with diacritics the body does not carry.
    expect(slugs(searchArticles(arabic, arabicBodies, 'مَبِيعَات'))).toEqual(['start'])
    expect(slugs(searchArticles(arabic, arabicBodies, 'صباح'))).toEqual(['schedules'])
  })

  it('Arabic ignores the alef variants and taa marbuta against haa', () => {
    // الصلاحية typed with haa for the taa marbuta, and the أ of أحصل typed as a bare alef.
    expect(slugs(searchArticles(arabic, arabicBodies, 'الصلاحيه'))).toEqual(['start'])
    expect(slugs(searchArticles(arabic, arabicBodies, 'احصل'))).toEqual(['start'])
    // إدارة written in the body as الإدارة; typed with a bare alef and a haa.
    expect(slugs(searchArticles(arabic, arabicBodies, 'الاداره'))).toEqual(['schedules'])
    // آ (alef madda) folds too.
    expect(slugs(searchArticles([meta('x', 'آخر التحديثات')], {}, 'اخر'))).toEqual(['x'])
  })

  it('a query with a hyphen or underscore finds the body that wrote it (both sides read the marks as spaces)', () => {
    const bodies = { boards: 'Use the drill-down to open the rows; set page_size first.' }
    const list = [meta('boards', 'Boards')]
    expect(slugs(searchArticles(list, bodies, 'drill-down'))).toEqual(['boards'])
    expect(slugs(searchArticles(list, bodies, 'page_size'))).toEqual(['boards'])
    expect(slugs(searchArticles(list, bodies, 'drill-up'))).toEqual([])
  })
})
