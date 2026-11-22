/**
 * oms 953 (BackOffice spec 4182 §D "print route"): the whole help prints in one language. The print page says it is
 * ready (`data-print-ready`) only once every article has arrived, every picture it names has settled (loaded or
 * failed) and the contents' page numbers are laid out; the contents' numbers count the cover, the contents and each
 * article from its own new page.
 */
import { describe, expect, it } from 'vitest'
import type { HelpArticle } from '@/core/models/help'
import { articleImages, contentsPageNumbers, helpPrintHref, helpPrintLang, pagesOfBlocks, printReady, type PrintBlock } from './help-print'

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

describe('pagesOfBlocks', () => {
  // A page holds 1000 px. `text(top, height)` breaks between 20 px lines; `solid` must not be split.
  const text = (top: number, height: number): PrintBlock => ({ top, height, line: 20 })
  const solid = (top: number, height: number): PrintBlock => ({ top, height })
  const heading = (top: number, height: number): PrintBlock => ({ top, height, line: height, keepWithNext: true })

  it('is one page for nothing, and for blocks that fit', () => {
    expect(pagesOfBlocks([], 1000)).toBe(1)
    expect(pagesOfBlocks([text(0, 400), solid(420, 500)], 1000)).toBe(1)
  })

  it('text runs on to the next page', () => {
    expect(pagesOfBlocks([text(0, 900), text(920, 400)], 1000)).toBe(2)
  })

  it('a block that must not split and does not fit starts the next page, and the space left behind is lost', () => {
    // 1880 px of content fits two pages by height, but the picture at 900 moves whole to page 2 (900-1500),
    // and the text after it then runs past page 2's end (1900) onto page 3.
    expect(pagesOfBlocks([text(0, 880), solid(900, 600), text(1520, 400)], 1000)).toBe(3)
  })

  it('a heading moves with the start of its next block', () => {
    // The heading fits at 960-980, but its paragraph's first two lines would not: both start page 2.
    expect(pagesOfBlocks([text(0, 940), heading(960, 20), text(990, 600)], 1000)).toBe(2)
    // Before a block that must not split, the heading goes with all of it, and what follows fits page 2 (920-1920)…
    expect(pagesOfBlocks([text(0, 900), heading(920, 20), solid(950, 300), text(1260, 650)], 1000)).toBe(2)
    // …where a plain block left at the page bottom would let page 2 start lower (950) and run onto page 3.
    expect(pagesOfBlocks([text(0, 900), solid(920, 20), solid(950, 300), text(1260, 700)], 1000)).toBe(3)
  })

  it('a chain of them — a heading, then a table’s header row — moves with the first body row', () => {
    const header: PrintBlock = { top: 960, height: 20, keepWithNext: true }
    // The heading and the header row fit (920-980), the first body row (990-1030) does not: all three start page 2
    // at 920, so the text after them runs past its end (1920) onto page 3…
    expect(pagesOfBlocks([text(0, 900), heading(920, 20), header, solid(990, 40), text(1030, 895)], 1000)).toBe(3)
    // …where, with nothing kept together, only the body row moves and page 2 (990-1990) holds it all.
    expect(pagesOfBlocks([text(0, 900), solid(920, 20), solid(960, 20), solid(990, 40), text(1030, 895)], 1000)).toBe(2)
  })

  it('a paragraph whose first two lines do not fit starts the next page', () => {
    expect(pagesOfBlocks([solid(0, 975), text(980, 1000)], 1000)).toBe(2)
    expect(pagesOfBlocks([solid(0, 955), text(960, 1000)], 1000)).toBe(2)
  })

  it('text breaks at its last whole line, so a long paragraph can take one more page than its height says', () => {
    // Lines of 30 px from 10: page 1 ends after line 33 (1000); page 2 after 2000 - 10 = 1990 ≈ line 66 (1990);
    // 2010 px of text ends at 2020, past page 2's end.
    expect(pagesOfBlocks([{ top: 10, height: 2010, line: 30 }], 1000)).toBe(3)
  })

  it('a block taller than a page is cut anyway', () => {
    expect(pagesOfBlocks([text(0, 100), solid(120, 2500)], 1000)).toBe(4)
  })
})

describe('contentsPageNumbers', () => {
  const run = (height: number): PrintBlock[] => [{ top: 0, height, line: 20 }]
  // A page holds 1000 px. The cover is page 1; the contents (500 px) is page 2; each article starts a new page.
  it('numbers each article from its own new page, after the cover and the contents', () => {
    expect(contentsPageNumbers({ pageHeight: 1000, contents: run(500), articles: [run(300), run(2500), run(1000), run(10)] })).toEqual([3, 4, 7, 8])
  })

  it('a contents running onto a second page pushes every article on', () => {
    expect(contentsPageNumbers({ pageHeight: 1000, contents: run(1200), articles: [run(300), run(300)] })).toEqual([4, 5])
  })

  it('an article not yet measured still takes one page', () => {
    expect(contentsPageNumbers({ pageHeight: 1000, contents: [], articles: [[], []] })).toEqual([3, 4])
  })

  it('an article whose picture is pushed to a new page moves every later article on', () => {
    const pushed: PrintBlock[] = [{ top: 0, height: 880, line: 20 }, { top: 900, height: 600 }, { top: 1520, height: 400, line: 20 }]
    expect(contentsPageNumbers({ pageHeight: 1000, contents: run(500), articles: [pushed, run(100)] })).toEqual([3, 6])
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
