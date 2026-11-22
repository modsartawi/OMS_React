/**
 * oms 953 (BackOffice spec 4182 §D "print route"): the whole help prints in one language. The print page says it is
 * ready (`data-print-ready`) only once every article has arrived, every picture it names has settled (loaded or
 * failed) and the contents' page numbers are laid out; the contents' numbers count the cover, the contents and each
 * article from its own new page.
 */
import { describe, expect, it } from 'vitest'
import type { HelpArticle } from '@/core/models/help'
import { articleImages, contentsPageNumbers, helpPrintHref, helpPrintLang, printReady } from './help-print'

const article = (slug: string, markdown: string): HelpArticle => ({
  slug,
  title: slug,
  order: 0,
  access: ['viewer'],
  screens: [],
  questions: [],
  checkedAgainst: '',
  markdown,
  sections: [],
})

describe('articleImages', () => {
  it('lists the help pictures an article names, in the print language, once each; another host is not a picture', () => {
    const md = '![a](images/boards-editor.en.png)\n\n![b](images/shared.png) ![a again](images/boards-editor.en.png)\n\n![x](https://example.com/x.png)'
    expect(articleImages(md, 'ar')).toEqual(['boards-editor.ar.png', 'shared.png'])
    expect(articleImages('No pictures here.', 'en')).toEqual([])
  })

  it('image syntax inside code (a fence, a span, an indented block) or escaped is text, not a picture the print waits for', () => {
    const md = [
      '```md',
      '![in a fence](images/fenced.en.png)',
      '```',
      '',
      '~~~',
      '![tilde fence](images/tilde.png)',
      '~~~',
      '',
      'Write `![alt](images/span.png)` to add one. \\![escaped](images/escaped.png)',
      '',
      '    ![indented code](images/indented.png)',
      '',
      '![real](images/real.en.png)',
    ].join('\n')
    expect(articleImages(md, 'en')).toEqual(['real.en.png'])
  })
})

describe('printReady', () => {
  const articles = [article('start', '![a](images/one.en.png)'), article('boards', '![b](images/two.en.png)')]

  it('is not ready while an article is still on its way', () => {
    expect(printReady({ articles: [articles[0], undefined], settled: new Set(['one.en.png', 'two.en.png']), lang: 'en', paged: true })).toBe(false)
  })

  it('is not ready until every picture has settled, loaded or failed', () => {
    expect(printReady({ articles, settled: new Set(), lang: 'en', paged: true })).toBe(false)
    expect(printReady({ articles, settled: new Set(['one.en.png']), lang: 'en', paged: true })).toBe(false)
    expect(printReady({ articles, settled: new Set(['one.en.png', 'two.en.png']), lang: 'en', paged: true })).toBe(true)
  })

  it('an article that failed to load (null) does not hold the paper back', () => {
    expect(printReady({ articles: [articles[0], null], settled: new Set(['one.en.png']), lang: 'en', paged: true })).toBe(true)
  })

  it('waits for the contents page numbers', () => {
    expect(printReady({ articles, settled: new Set(['one.en.png', 'two.en.png']), lang: 'en', paged: false })).toBe(false)
  })

  it('an area with no pictures is ready once its articles are in', () => {
    expect(printReady({ articles: [article('start', 'Words only.')], settled: new Set(), lang: 'ar', paged: true })).toBe(true)
    expect(printReady({ articles: [], settled: new Set(), lang: 'en', paged: true })).toBe(true)
  })
})

describe('contentsPageNumbers', () => {
  // A page holds 1000 px. The cover is page 1; the contents (500 px) is page 2; each article starts a new page.
  it('numbers each article from its own new page, after the cover and the contents', () => {
    expect(contentsPageNumbers({ pageHeight: 1000, contentsHeight: 500, articleHeights: [300, 2500, 1000, 10] })).toEqual([3, 4, 7, 8])
  })

  it('a contents running onto a second page pushes every article on', () => {
    expect(contentsPageNumbers({ pageHeight: 1000, contentsHeight: 1200, articleHeights: [300, 300] })).toEqual([4, 5])
  })

  it('an article not yet measured still takes one page', () => {
    expect(contentsPageNumbers({ pageHeight: 1000, contentsHeight: 0, articleHeights: [0, 0] })).toEqual([3, 4])
  })
})

describe('the print route', () => {
  it('opens in a language, and reads only en or ar back', () => {
    expect(helpPrintHref('analytics', 'ar')).toBe('/analytics/print/help?lang=ar')
    expect(helpPrintLang(new URLSearchParams('lang=ar'))).toBe('ar')
    expect(helpPrintLang(new URLSearchParams('lang=fr'))).toBe('en')
    expect(helpPrintLang(new URLSearchParams(''))).toBe('en')
  })
})
